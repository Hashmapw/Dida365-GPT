import { Modal, Form, Input, Typography, Space } from 'antd';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (values: { baseUrl?: string; apiKey?: string }) => void;
  baseUrl?: string;
  apiKey?: string;
}

export function AiSettingsModal({ open, onClose, onSave, baseUrl, apiKey }: Props) {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="AI 接入配置"
      destroyOnClose
      onOk={() => form.submit()}
      okText="保存"
      cancelText="取消"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Typography.Paragraph type="secondary">
          临时覆盖 OpenAI Base URL 与 API Key，刷新后会恢复服务端默认配置
        </Typography.Paragraph>
        <Form
          layout="vertical"
          form={form}
          initialValues={{ baseUrl, apiKey }}
          onFinish={(values) => {
            onSave(values);
            onClose();
          }}
        >
          <Form.Item label="OpenAI Base URL" name="baseUrl">
            <Input placeholder="例如：https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item label="OpenAI API Key" name="apiKey">
            <Input.Password placeholder="sk-..." autoComplete="off" />
          </Form.Item>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          为安全起见，以上字段仅存在当前会话的浏览器内存，不会被持久化
        </Typography.Paragraph>
      </Space>
      <div style={{ display: 'none' }}>{apiKey}</div>
    </Modal>
  );
}
