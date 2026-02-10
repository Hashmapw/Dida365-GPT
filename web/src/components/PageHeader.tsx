import React from 'react';
import { Card, Space, Typography } from 'antd';

interface Props {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  extra?: React.ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, extra }: Props) {
  return (
    <Card className="hero card" bordered={false} bodyStyle={{ padding: '20px 24px' }}>
      <div className="hero-header-row">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {extra && <div className="hero-status">{extra}</div>}
      </div>
      {subtitle && <p className="subtitle single-line">{subtitle}</p>}
    </Card>
  );
}
