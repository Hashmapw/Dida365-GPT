import { Modal, Typography, Space, Button, Alert, Form, Input } from 'antd';
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';

interface Props {
  open: boolean;
  onClose: () => void;
  onStartOauth: () => void;
  onCheckOauth: () => void;
  onExchangeCode: (values: { code: string; clientId?: string; clientSecret?: string }) => void;
  redirectUri: string;
  statusText: string;
  statusType: 'success' | 'error' | 'info' | 'warning';
  oauthState?: string | null;
  submitting?: boolean;
}

export function OauthModal({
  open,
  onClose,
  onStartOauth,
  onCheckOauth,
  onExchangeCode,
  redirectUri,
  statusText,
  statusType,
  oauthState,
  submitting = false,
}: Props) {
  const [form] = Form.useForm();

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="滴答授权中心" width={720} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          type={statusType}
          message={statusText}
          description={oauthState ? `当前 OAuth State: ${oauthState}` : '未发现授权会话'}
          showIcon
        />

        <Space align="start" style={{ width: '100%' }} size="large">
          <div style={{ flex: 1 }}>
            <Typography.Title level={5}>方式一 · 一键授权</Typography.Title>
            <Typography.Paragraph type="secondary">
              自动打开滴答登录页，完成后会回到此窗口并缓存 Token
            </Typography.Paragraph>
            <Space>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={onStartOauth}>
                立即一键授权
              </Button>
              <Button icon={<ReloadOutlined />} onClick={onCheckOauth}>
                刷新授权状态
              </Button>
            </Space>
          </div>
          <div style={{ flex: 1 }}>
            <Typography.Title level={5}>方式二 · 手动授权</Typography.Title>
            <Typography.Paragraph type="secondary">滴答授权页面复制 Authorization Code 后提交</Typography.Paragraph>
            <Form layout="vertical" form={form} onFinish={onExchangeCode}>
              <Form.Item label="Authorization Code" name="code" rules={[{ required: true, message: '请填写 code' }]}>
                <Input placeholder="例如：6WA85v" />
              </Form.Item>
              <Form.Item label="Client ID" name="clientId">
                <Input placeholder="覆盖 .env 中的 clientId" />
              </Form.Item>
              <Form.Item label="Client Secret" name="clientSecret">
                <Input placeholder="覆盖 .env 中的 clientSecret" />
              </Form.Item>
              <Form.Item label="Redirect URI">
                <Input value={redirectUri} readOnly />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>
                手动授权
              </Button>
            </Form>
          </div>
        </Space>

      </Space>
    </Modal>
  );
}
