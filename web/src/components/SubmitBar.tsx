import { DatabaseOutlined, HistoryOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Typography } from 'antd';

interface Props {
  onSubmit: () => void;
  submitting: boolean;
  taskCount: number;
  timeZone: string;
  onShowProjects: () => void;
  onShowSubmissions: () => void;
}

export function SubmitBar({ onSubmit, submitting, taskCount, timeZone, onShowProjects, onShowSubmissions }: Props) {
  return (
    <div className="bottom-bar">
      <div className="bottom-content">
        <Flex gap={12} wrap align="center">
          <Typography.Text strong>{taskCount ? `准备提交 ${taskCount} 条任务` : '暂无可提交任务'}</Typography.Text>
          <Typography.Text type="secondary">时区：{timeZone || 'Local'}</Typography.Text>
          <Space className="pill-row" align="center">
            <Button icon={<DatabaseOutlined />} onClick={onShowProjects}>
              清单列表
            </Button>
            <Button icon={<HistoryOutlined />} onClick={onShowSubmissions}>
              提交记录
            </Button>
          </Space>
        </Flex>
        <Button
          type="primary"
          size="large"
          icon={<SendOutlined />}
          onClick={onSubmit}
          disabled={!taskCount}
          loading={submitting}
        >
          提交到滴答清单
        </Button>
      </div>
    </div>
  );
}
