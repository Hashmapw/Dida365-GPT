import { Button, Card, Flex, Progress, Select, Space, Typography } from 'antd';
import { ThunderboltOutlined, PlusOutlined } from '@ant-design/icons';
import TextArea from 'antd/es/input/TextArea';

interface Props {
  rawText: string;
  locale: 'zh' | 'en';
  onRawChange: (value: string) => void;
  onLocaleChange: (value: 'zh' | 'en') => void;
  onGenerate: () => void;
  onAddTask: () => void;
  generating: boolean;
  progress: { current: number; total: number };
}

export function RawInputSection({
  rawText,
  locale,
  onRawChange,
  onLocaleChange,
  onGenerate,
  onAddTask,
  generating,
  progress,
}: Props) {
  const percent = progress.total ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  return (
    <Card title="1. 粘贴原始任务" extra={<LocaleSwitcher locale={locale} onChange={onLocaleChange} />}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <TextArea
          rows={8}
          value={rawText}
          placeholder={`支持 Markdown 勾选列表或自然语言描述，AI 会保持语言风格并补充细节。
- [ ] 明天下午3点-5点提示我听讲座
- [x] 今天11点开组会并作LLM研究进展的汇报`}
          onChange={(e) => onRawChange(e.target.value)}
        />
        <Flex gap={12} align="center" justify="space-between" wrap>
          {generating ? (
            <Flex align="center" gap={12} style={{ minWidth: 260, flex: 1 }}>
              <Progress percent={percent} status="active" size="small" style={{ flex: 1 }} />
              <Typography.Text type="secondary">
                {progress.current}/{progress.total}
              </Typography.Text>
            </Flex>
          ) : (
            <div />
          )}
          <Space>
            <Button type="primary" icon={<ThunderboltOutlined />} loading={generating} onClick={onGenerate}>
              AI 整理
            </Button>
            <Button icon={<PlusOutlined />} onClick={onAddTask}>
              手动添加
            </Button>
          </Space>
        </Flex>
      </Space>
    </Card>
  );
}

function LocaleSwitcher({ locale, onChange }: { locale: 'zh' | 'en'; onChange: (value: 'zh' | 'en') => void }) {
  return (
    <Space align="center">
      <Typography.Text type="secondary">输出语言</Typography.Text>
      <Select
        value={locale}
        style={{ width: 140 }}
        onChange={(value) => onChange(value as 'zh' | 'en')}
        options={[
          { label: '中文', value: 'zh' },
          { label: 'English', value: 'en' },
        ]}
      />
    </Space>
  );
}
