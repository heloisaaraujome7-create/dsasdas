import React from 'react';
import { PhoneCall } from 'lucide-react';

export function PageTitle({ eyebrow = 'SEVENPRO MONITORIA', title, subtitle, children }) {
  return <div className="page-title-row"><div><div className="section-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="title-actions">{children}</div>}</div>;
}
export function EmptyState({ icon: Icon = PhoneCall, title, text }) {
  return <div className="empty-state" style={{ padding: '44px 20px' }}><Icon size={28} style={{ display: 'block', margin: '0 auto 12px', opacity: .65 }} /><b style={{ display: 'block', color: '#ddd', marginBottom: 7 }}>{title}</b><span>{text}</span></div>;
}
export function Pill({ tone = 'muted', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
