import type { ReactNode } from 'react';
import { batteryPercent, spaceLabels, type SpaceForecast } from '@/lib/matchSpace';
import './match-space-bar.css';

export default function MatchSpaceBar({ forecast, label, forecastLabel = 'lägst 7 d' }: {
  forecast: SpaceForecast; label?: ReactNode; forecastLabel?: string;
}) {
  const current = batteryPercent(forecast.current, forecast.capacity);
  const projected = batteryPercent(forecast.lowest, forecast.capacity);
  return <div className="space-battery">
    <div className="space-battery-heading">
      {label && <strong className="space-battery-name">{label}</strong>}
      <span className="space-battery-values"><span>{current}% <span>nu</span></span><span className="space-battery-projected">{projected}% <span>{forecastLabel}</span></span></span>
    </div>
    <div className="space-battery-track" role="img" aria-label={`Batteri ${current} procent nu, prognos ${projected} procent som lägst under sju dagar. ${spaceLabels[forecast.level]}. Uppskattning.`}>
      <span className="space-battery-current" style={{width:`${current}%`}} />
      <span className="space-battery-future" style={{width:`${projected}%`}} />
      <span className="space-battery-marker" style={{left:`${current}%`}} />
    </div>
  </div>;
}
