/**
 * Map data credit. The bottom sheet covers Leaflet's own corner credit, so the
 * screens show it here instead (OpenStreetMap and CARTO both require it).
 */
export function MapCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-tight text-muted ${className}`}>
      © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>{' '}
      contributors · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="underline">CARTO</a>
    </p>
  );
}
