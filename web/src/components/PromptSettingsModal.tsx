import React, { useEffect, useState } from 'react';
import { Modal, Typography, Space, Button, Popover } from 'antd';
import TextArea from 'antd/es/input/TextArea';

interface Props {
  open: boolean;
  onClose: () => void;
  systemHint: string;
  userTemplate: string;
  loading?: boolean;
  saving?: boolean;
  onSave: (values: { systemHint: string; userTemplate: string }) => void;
}

export function PromptSettingsModal({
  open,
  onClose,
  systemHint,
  userTemplate,
  loading = false,
  saving = false,
  onSave,
}: Props) {
  const [values, setValues] = useState({ systemHint: '', userTemplate: '' });

  useEffect(() => {
    setValues({ systemHint, userTemplate });
  }, [systemHint, userTemplate]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Prompt 设置"
      footer={null}
      destroyOnClose
      width={960}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          编辑后会保存到 .env 中的 SYSTEM_HINT 与 USER_TEMPLATE
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          可用变量：
          <Popover title="{{system_hint}}" content="系统提示词，下面的第一个框">
            <code>{'{{system_hint}}'}</code>
          </Popover>{' '}
          <Popover title="{{project_list}}" content="当前可用清单列表的 JSON 数组">
            <code>{'{{project_list}}'}</code>
          </Popover>{' '}
          <Popover title="{{markdown}}" content="你粘贴的原始任务 Markdown">
            <code>{'{{markdown}}'}</code>
          </Popover>{' '}
          <Popover title="{{current_time}}" content="当前时间（ISO 8601）">
            <code>{'{{current_time}}'}</code>
          </Popover>{' '}
          <Popover title="{{time_hint}}" content="时区提示（如 “(ISO 8601, timezone Asia/Shanghai)”）">
            <code>{'{{time_hint}}'}</code>
          </Popover>{' '}
          <Popover title="{{locale}}" content="输出语言（中文/English）">
            <code>{'{{locale}}'}</code>
          </Popover>
        </Typography.Paragraph>
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          SYSTEM_HINT
        </Typography.Title>
        <TextArea
          rows={10}
          value={values.systemHint}
          onChange={(e) => setValues((prev) => ({ ...prev, systemHint: e.target.value }))}
          placeholder="SYSTEM_HINT"
          disabled={loading}
        />
        <Typography.Title level={5} style={{ marginBottom: 4 }}>
          USER_TEMPLATE
        </Typography.Title>
        <TextArea
          rows={10}
          value={values.userTemplate}
          onChange={(e) => setValues((prev) => ({ ...prev, userTemplate: e.target.value }))}
          placeholder="USER_TEMPLATE"
          disabled={loading}
        />
        <Button type="primary" loading={saving} disabled={loading} onClick={() => onSave(values)}>
          保存提示词
        </Button>
      </Space>
    </Modal>
  );
}
