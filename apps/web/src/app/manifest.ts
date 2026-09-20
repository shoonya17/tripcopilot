import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trip Copilot', short_name: 'Trip Copilot', description: 'Journey-aware travel wallet', start_url: '/', display: 'standalone', background_color: '#f7f8fa', theme_color: '#111827', icons: [],
  };
}
