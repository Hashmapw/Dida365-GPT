import { Modal, List, Typography, Space, Empty, Button, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { SubmissionEntry } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  entries: SubmissionEntry[];
  loading: boolean;
  onRefresh: () => void;
}

export function SubmissionsModal({ open, onClose, entries, loading, onRefresh }: Props) {
  return (
    <Modal open={open} onCancel={onClose} title="提交记录" footer={null} width={640} destroyOnClose>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ marginBottom: 12 }}>
        刷新
      </Button>
      {loading ? (
        <Spin />
      ) : entries.length ? (
        <List
          dataSource={[...entries].reverse()}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical">
                <Typography.Text strong>{item.title || '未命名任务'}</Typography.Text>
                <Typography.Text type="secondary">{item.projectName || item.projectId || '未知清单'}</Typography.Text>
                {item.id ? <Typography.Text type="secondary">ID: {item.id}</Typography.Text> : null}
                {item.createdAt ? (
                  <Typography.Text type="secondary">
                    {new Date(item.createdAt).toLocaleString()}
                  </Typography.Text>
                ) : null}
                {item.error ? <Typography.Text type="danger">{String(item.error)}</Typography.Text> : null}
              </Space>
            </List.Item>
          )}
        />
      ) : (
        <Empty description="暂无提交记录" />
      )}
    </Modal>
  );
}
