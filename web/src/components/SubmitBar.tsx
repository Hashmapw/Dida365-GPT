import { SendOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Typography } from 'antd';

interface Props {
  onSubmit: () => void;
  submitting: boolean;
  taskCount: number;
  timeZone: string;
}

export function SubmitBar({ onSubmit, submitting, taskCount, timeZone }: Props) {
  return (
    <div className="bottom-bar">
      <div className="bottom-content">
        <Flex gap={12} wrap align="center">
          <Typography.Text strong>{taskCount ? `准备提交 ${taskCount} 条任务` : '暂无可提交任务'}</Typography.Text>
          <Typography.Text type="secondary">时区：{timeZone || 'Local'}</Typography.Text>
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
