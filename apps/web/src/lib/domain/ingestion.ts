import { db } from '../db';
import { env } from '../env';
import {
  extractTrip,
  extractTripFromImage,
  manualExtractionResult,
  type ExtractionMeta,
} from '../ai';
import {
  validateExtractedTrip,
  bookingFingerprint,
  zonedDateTimeToUtc,
} from '@tripcopilot/core';
import { recordEvent } from '../events';
import { writeProvenance } from '../provenance';
import { recomputeTripRelations } from './derived';
import type { Channel, Prisma } from '@prisma/client';
import type { ExtractedTrip } from '@tripcopilot/core';

export async function createIngestion(input: {
  tenantId: string;
  travelerId: string;
  channel: Channel;
  rawText?: string;
  sourceReference?: string;
  contentHash?: string;
  documentId?: string;
  tripId?: string;
  idempotencyKey: string;
}) {
  const existing = await db.ingestionRecord.findFirst({
    where: {
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
    },
  });

  if (existing) return existing;

  const record = await db.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const created = await tx.ingestionRecord.create({
        data: {
          tenantId: input.tenantId,
          channel: input.channel,
          sourceReference: input.sourceReference,
          receivedAt: new Date(),
          productState: 'RECEIVED',
          securityState: 'CLEARED',
          implementationState: 'RECEIVED',
          contentHash: input.contentHash,
          documentId: input.documentId,
          tripId: input.tripId,
          travelerId: input.travelerId,
          rawText: input.rawText,
          idempotencyKey: input.idempotencyKey,
        },
      });

      await recordEvent(tx, {
        tenantId: input.tenantId,
        tripId: input.tripId,
        eventName: 'BOOKING_RECEIVED',
        behavioralClass: null,
        actorType: 'SYSTEM',
        payload: {
          ingestionId: created.ingestionId,
          channel: input.channel,
        },
      });

      return created;
    },
  );

  return record;
}

function structuredFromManual(
  rawText: string | null,
): ExtractedTrip | null {
  const prefix = 'TRIP_COPILOT_MANUAL_JSON:';

  if (!rawText?.startsWith(prefix)) return null;

  try {
    return JSON.parse(
      rawText.slice(prefix.length),
    ) as ExtractedTrip;
  } catch {
    throw new Error(
      'PARSE_FAILED: invalid structured manual payload',
    );
  }
}

function valuePresent(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ''
  );
}

function findSourceSpan(
  sourceText: string,
  value: unknown,
) {
  if (value == null) {
    return {
      location: null as any,
      excerpt: undefined as string | undefined,
    };
  }

  const needle = String(value).trim();

  if (!needle) {
    return {
      location: null as any,
      excerpt: undefined as string | undefined,
    };
  }

  const start = sourceText
    .toLowerCase()
    .indexOf(needle.toLowerCase());

  if (start < 0) {
    return {
      location: null as any,
      excerpt: undefined as string | undefined,
    };
  }

  const excerptStart = Math.max(0, start - 80);
  const excerptEnd = Math.min(
    sourceText.length,
    start + needle.length + 80,
  );

  return {
    location: {
      start,
      end: start + needle.length,
    },
    excerpt: sourceText.slice(
      excerptStart,
      excerptEnd,
    ),
  };
}

function sourceEvidence(
  sourceText: string,
  value: unknown,
  fieldKey: string,
  fieldMeta: Record<string, ExtractionMeta>,
) {
  return (
    findSourceSpan(sourceText, value).excerpt ??
    fieldMeta[fieldKey]?.evidence ??
    undefined
  );
}

async function persistCandidates(
  tenantId: string,
  ingestionId: string,
  extraction: ExtractedTrip,
  extractionMethod: string,
  sourceText: string,
  fieldMeta: Record<string, ExtractionMeta>,
) {
  const candidates: Array<{
    entityType: string;
    fieldName: string;
    value: unknown;
    excerpt?: string;
  }> = [];

  for (const [fieldName, value] of Object.entries(
    extraction,
  )) {
    if (
      fieldName === 'segments' ||
      !valuePresent(value)
    ) {
      continue;
    }

    const span = findSourceSpan(
      sourceText,
      value,
    );

    candidates.push({
      entityType: 'TRIP',
      fieldName,
      value,
      excerpt:
        span.excerpt ??
        fieldMeta[fieldName]?.evidence ??
        undefined,
    });
  }

  extraction.segments.forEach(
    (segment, index) => {
      for (const [fieldName, value] of Object.entries(
        segment,
      )) {
        if (!valuePresent(value)) continue;

        const key = `segments.${index}.${fieldName}`;

        const span = findSourceSpan(
          sourceText,
          value,
        );

        candidates.push({
          entityType: 'SEGMENT',
          fieldName: key,
          value,
          excerpt:
            span.excerpt ??
            fieldMeta[key]?.evidence ??
            undefined,
        });
      }
    },
  );

  await db.sourceCandidate.createMany({
    data: candidates.map((c) => ({
      tenantId,
      ingestionId,
      entityType: c.entityType,
      fieldName: c.fieldName,
      candidateValue:
        c.value as Prisma.InputJsonValue,
      normalizedValue:
        c.value as Prisma.InputJsonValue,
      confidence: Math.max(
        0,
        Math.min(
          1,
          fieldMeta[c.fieldName]?.confidence ??
            env.OPENAI_EXTRACTION_THRESHOLD,
        ),
      ),
      sourceLocation: findSourceSpan(
        sourceText,
        c.value,
      ).location,
      sourceExcerpt: c.excerpt,
      extractionMethod,
      extractedAt: new Date(),
    })),
  });
}

function detectImageMime(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.slice(0, 4).toString() === 'RIFF' &&
    bytes.slice(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export async function processIngestion(
  ingestionId: string,
  tenantId: string,
  opts?: { force?: boolean },
) {
  const ingestion =
    await db.ingestionRecord.findFirst({
      where: {
        ingestionId,
        tenantId,
      },
    });

  if (!ingestion) {
    throw new Error('NOT_FOUND: ingestion');
  }

  if (ingestion.productState === 'CONFIRMED') {
    return ingestion;
  }
  const sourceText = ingestion.rawText ?? '';

  if (!sourceText && ingestion.channel !== 'IMAGE') {
    throw new Error(
      'PARSE_FAILED:NO_SOURCE_TEXT',
    );
  }
  await db.ingestionRecord.update({
    where: { ingestionId },
    data: {
      implementationState: 'PARSING',
      productState: 'PARSING',
      parseAttemptCount: {
        increment: 1,
      },
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  try {    const isManual = ingestion.channel === 'MANUAL';
    const isImage = ingestion.channel === 'IMAGE';

    let extractionResult;

    if (isManual) {
      const manualTrip = structuredFromManual(sourceText);
      extractionResult = manualTrip
        ? manualExtractionResult(manualTrip)
        : await extractTrip(sourceText);
    } else if (isImage) {
      if (!ingestion.documentId) {
        throw new Error('PARSE_FAILED:IMAGE_WITHOUT_DOCUMENT');
      }
      const doc = await db.document.findFirst({
        where: {
          documentId: ingestion.documentId,
          tenantId,
        },
      });
      if (!doc) {
        throw new Error('NOT_FOUND:document');
      }
      const { readSource } = await import('../storage');
      const bytes = Buffer.from(await readSource(doc.storageObjectKey));
      const detected = detectImageMime(bytes);
      if (!detected) {
        throw new Error('PARSE_FAILED:UNRECOGNIZED_IMAGE_FORMAT');
      }
      extractionResult = await extractTripFromImage(
        new Uint8Array(bytes),
        detected,
      );
    } else {
      extractionResult = await extractTrip(sourceText);
    }
    const extraction = extractionResult.trip;

    await db.ingestionRecord.update({
      where: { ingestionId },
      data: {
        implementationState: 'EXTRACTED',
        productState: 'EXTRACTED',
      },
    });

    await persistCandidates(
      tenantId,
      ingestionId,
      extraction,
      isManual
        ? 'MANUAL_STRUCTURED'
        : 'OPENAI_STRUCTURED_OUTPUT',
      sourceText,
      extractionResult.fieldMeta,
    );

    const lowConfidenceMaterial =
      Object.entries(
        extractionResult.fieldMeta,
      ).some(([key, meta]) => {
        const fieldName = key.startsWith(
          'segments.',
        )
          ? key
              .split('.')
              .slice(2)
              .join('.')
          : key;

        const material =
          fieldName === 'segment_type' ||
          fieldName === 'departure_local' ||
          fieldName === 'arrival_local' ||
          fieldName === 'departure_location' ||
          fieldName === 'arrival_location' ||
          fieldName === 'start_at' ||
          fieldName === 'end_at';

        const parts = key.split('.');

        const actual =
          parts[0] === 'segments'
            ? (
                extraction.segments[
                  Number(parts[1])
                ] as any
              )?.[fieldName]
            : (extraction as any)[key];

        return (
          material &&
          valuePresent(actual) &&
          meta.confidence <
            env.OPENAI_EXTRACTION_THRESHOLD
        );
      });

    const validation =
      validateExtractedTrip(extraction);

    await db.validationResultRecord.create({
      data: {
        tenantId,
        ingestionId,
        result: validation.result,
        issues:
          validation.issues as unknown as Prisma.InputJsonValue,
      },
    });

    if (
      !opts?.force &&
      (validation.result !== 'VALID' ||
        lowConfidenceMaterial)
    ) {
      await db.ingestionRecord.update({
        where: { ingestionId },
        data: {
          implementationState: 'VALIDATED',
          productState: 'REVIEW_REQUIRED',
        },
      });

      return db.ingestionRecord.findUnique({
        where: { ingestionId },
      });
    }

    const result = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        let trip = ingestion.tripId
          ? await tx.trip.findFirst({
              where: {
                tripId: ingestion.tripId,
                tenantId,
              },
            })
          : null;

        const owner =
          ingestion.travelerId
            ? await tx.traveler.findFirst({
                where: {
                  travelerId:
                    ingestion.travelerId,
                  tenantId,
                },
              })
            : null;

        if (!owner) {
          throw new Error(
            'NOT_FOUND: traveler',
          );
        }

        if (!trip) {
          trip = await tx.trip.create({
            data: {
              tenantId,
              ownerTravelerId:
                owner.travelerId,
              title:
                extraction.title ??
                'Untitled trip',
              status: 'PLANNED',
              startAt:
                zonedDateTimeToUtc(
                  extraction.start_at,
                  extraction.start_timezone,
                ),
              endAt:
                zonedDateTimeToUtc(
                  extraction.end_at,
                  extraction.end_timezone,
                ),
              startTimezone:
                extraction.start_timezone ??
                owner.defaultTimezone,
              endTimezone:
                extraction.end_timezone ??
                owner.defaultTimezone,
            },
          });

          await recordEvent(tx, {
            tenantId,
            tripId: trip.tripId,
            eventName: 'TRIP_CREATED',
            actorType: 'SYSTEM',
            payload: {
              ingestionId,
            },
          });
        } else if (
          trip.ownerTravelerId !==
          owner.travelerId
        ) {
          throw new Error(
            'FORBIDDEN: ingestion traveler does not own target trip',
          );
        }

        const protectedUserFields =
          new Set<string>();

        const existingProvenance =
          await tx.fieldProvenance.findMany({
            where: {
              tenantId,
              entityType: 'TRIP',
              entityId: trip.tripId,
              isUserOriginated: true,
            },
          });

        for (const p of existingProvenance) {
          protectedUserFields.add(
            p.fieldName,
          );
        }

        const tripUpdates: Record<
          string,
          unknown
        > = {};

        const tripFields: Array<
          [string, unknown]
        > = [
          ['title', extraction.title],
          [
            'startAt',
            zonedDateTimeToUtc(
              extraction.start_at,
              extraction.start_timezone,
            ),
          ],
          [
            'endAt',
            zonedDateTimeToUtc(
              extraction.end_at,
              extraction.end_timezone,
            ),
          ],
          [
            'startTimezone',
            extraction.start_timezone,
          ],
          [
            'endTimezone',
            extraction.end_timezone,
          ],
        ];

        for (const [field, value] of tripFields) {
          if (
            !valuePresent(value) ||
            protectedUserFields.has(field)
          ) {
            continue;
          }

          tripUpdates[field] = value;
        }

        if (
          Object.keys(tripUpdates).length
        ) {
          trip = await tx.trip.update({
            where: {
              tripId: trip.tripId,
            },
            data: {
              ...tripUpdates,
              rowVersion: {
                increment: 1,
              },
            },
          });

          for (const [
            field,
            value,
          ] of Object.entries(
            tripUpdates,
          )) {
            await writeProvenance(tx, {
              tenantId,
              entityType: 'TRIP',
              entityId: trip.tripId,
              fieldName: field,
              sourceKind:
                ingestion.channel,
              sourceId:
                ingestion.documentId ??
                ingestion.ingestionId,
              sourceExcerpt: sourceEvidence(
                sourceText,
                value,
                field,
                extractionResult.fieldMeta,
              ),
              extractedBy:
                extractionResult.model,
              confidence:
                extractionResult
                  .fieldMeta[field]
                  ?.confidence ??
                env.OPENAI_EXTRACTION_THRESHOLD,
              isUserOriginated: isManual,
              userActorId: isManual
                ? ingestion.travelerId ??
                  undefined
                : undefined,
            });
          }
        }

        for (const s of extraction.segments) {
          const fingerprint =
            bookingFingerprint({
              supplier: s.supplier_name,
              bookingReference:
                s.booking_reference,
              departure:
                s.departure_local,
              arrival:
                s.arrival_local,
              departureLocation:
                s.departure_location,
              arrivalLocation:
                s.arrival_location,
            });

          const existing =
            await tx.segment.findFirst({
              where: {
                tenantId,
                tripId: trip.tripId,
                bookingReference:
                  s.booking_reference ??
                  undefined,
                supplierName:
                  s.supplier_name ??
                  undefined,
                departureLocation:
                  s.departure_location ??
                  undefined,
                arrivalLocation:
                  s.arrival_location ??
                  undefined,
              },
            });

          if (existing) {
            await tx.dedupDecision.create({
              data: {
                tenantId,
                ingestionId,
                result:
                  'DUPLICATE_ABSORBED',
                matchedEntityType:
                  'SEGMENT',
                matchedEntityId:
                  existing.segmentId,
                rationale: fingerprint,
              },
            });

            continue;
          }

          const departureUtc =
            zonedDateTimeToUtc(
              s.departure_local,
              s.departure_timezone,
            );

          const arrivalUtc =
            zonedDateTimeToUtc(
              s.arrival_local,
              s.arrival_timezone,
            );

          const segment =
            await tx.segment.create({
              data: {
                tenantId,
                tripId: trip.tripId,
                segmentType:
                   s.segment_type ?? 'OTHER',
                supplierName:
                  s.supplier_name,
                bookingReference:
                  s.booking_reference,
                departureLocal:
                  s.departure_local
                    ? new Date(
                        `${s.departure_local.replace(
                          /Z$/,
                          '',
                        )}Z`,
                      )
                    : null,
                departureTimezone:
                  s.departure_timezone,
                departureUtc,
                arrivalLocal:
                  s.arrival_local
                    ? new Date(
                        `${s.arrival_local.replace(
                          /Z$/,
                          '',
                        )}Z`,
                      )
                    : null,
                arrivalTimezone:
                  s.arrival_timezone,
                arrivalUtc,
                departureLocation:
                  s.departure_location,
                arrivalLocation:
                  s.arrival_location,
                status:
                  s.status ?? 'UNKNOWN',
              },
            });

          for (const [
            fieldName,
            value,
          ] of Object.entries(s)) {
            if (!valuePresent(value)) {
              continue;
            }

            const fieldKey = `segments.${extraction.segments.indexOf(
              s,
            )}.${fieldName}`;

            await writeProvenance(tx, {
              tenantId,
              entityType: 'SEGMENT',
              entityId: segment.segmentId,
              fieldName,
              sourceKind:
                ingestion.channel,
              sourceId:
                ingestion.documentId ??
                ingestion.ingestionId,
              sourceExcerpt: sourceEvidence(
                sourceText,
                value,
                fieldKey,
                extractionResult.fieldMeta,
              ),
              extractedBy:
                extractionResult.model,
              confidence:
                extractionResult
                  .fieldMeta[fieldKey]
                  ?.confidence ??
                env.OPENAI_EXTRACTION_THRESHOLD,
              isUserOriginated: isManual,
              userActorId: isManual
                ? ingestion.travelerId ??
                  undefined
                : undefined,
            });
          }

                if (s.fare_amount && s.fare_currency) {
            const amount = Number(s.fare_amount);
            const currency = String(s.fare_currency).toUpperCase();
            if (
              Number.isFinite(amount) &&
              amount > 0 &&
              /^[A-Z]{3}$/.test(currency)
            ) {
              const merchantOrDescription = s.supplier_name
                ? `${s.supplier_name} fare`
                : `${s.segment_type ?? 'Segment'} fare`;

              // Dedup: don't create a second pending expense for the same
              // trip + supplier + amount + currency. Prevents double-counting
              // when the same booking is uploaded twice via different
              // documents (different content hash → different segment).
              const existingFare = await tx.expense.findFirst({
                where: {
                  tenantId,
                  tripId: trip.tripId,
                  sourceType: 'EXTRACTED_FARE',
                  amount: amount.toFixed(4),
                  currency,
                  merchantOrDescription,
                },
              });

              if (!existingFare) {
                const segmentIndex = extraction.segments.indexOf(s);
                const fareMeta =
                  extractionResult.fieldMeta[
                    `segments.${segmentIndex}.fare_amount`
                  ];
                const incurredAt = s.departure_local
                  ? new Date(
                      `${String(s.departure_local).replace(/Z$/, '')}Z`,
                    )
                  : new Date();
                await tx.expense.create({
                  data: {
                    tenantId,
                    tripId: trip.tripId,
                    travelerId: ingestion.travelerId ?? undefined,
                    amount: amount.toFixed(4),
                    currency,
                    merchantOrDescription,
                    incurredAt,
                    location: s.departure_location ?? null,
                    source: 'DOCUMENT',
                    sourceType: 'EXTRACTED_FARE',
                    confidence:
                      typeof fareMeta?.confidence === 'number'
                        ? fareMeta.confidence
                        : null,
                    userConfirmed: false,
                  },
                });
              }
            }
          }
          await tx.dedupDecision.create({
            data: {
              tenantId,
              ingestionId,
              result: 'NEW',
              rationale: fingerprint,
            },
          });
        }

        if (ingestion.documentId) {
          await tx.document.update({
            where: {
              documentId:
                ingestion.documentId,
            },
            data: {
              tripId: trip.tripId,
              retentionState: 'ACTIVE',
            },
          });
        }

        await recordEvent(tx, {
          tenantId,
          tripId: trip.tripId,
          eventName:
            'INGESTION_COMMITTED',
          actorType: 'SYSTEM',
          payload: {
            reason:
              'ingestion_commit',
            ingestionId,
          },
        });

        return trip;
      },
      { timeout: 60_000, maxWait: 15_000 },
    );

    await db.ingestionRecord.update({
      where: { ingestionId },
      data: {
        implementationState: 'COMMITTED',
        productState: 'CONFIRMED',
        tripId: result.tripId,
      },
    });

    await recomputeTripRelations(
      result.tripId,
      tenantId,
    );

    return db.ingestionRecord.findUnique({
      where: { ingestionId },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error';

    await db.ingestionRecord.update({
      where: { ingestionId },
      data: {
        productState: 'PARSE_FAILED',
        lastErrorCode:
          'INGESTION_PROCESSING_FAILED',
        lastErrorMessage: message,
      },
    });

    throw error;
  }
}