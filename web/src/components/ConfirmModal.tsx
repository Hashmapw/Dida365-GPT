import { Modal, List, Space, Input, Checkbox, Select, Typography } from 'antd';
import { Project, TaskItem } from '../types';

const priorityOptions = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
  { value: 'none', label: '无' },
];

interface Props {
  open: boolean;
  tasks: TaskItem[];
  projects: Project[];
  submitting: boolean;
  onChange: (index: number, updates: Partial<TaskItem>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ open, tasks, projects, submitting, onChange, onCancel, onConfirm }: Props) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="确认创建"
      confirmLoading={submitting}
      title="确认提交这些任务"
      width={820}
    >
      <Typography.Paragraph type="secondary">
        发送到滴答清单之前，最终检查并可直接调整标题、简述、优先级和清单
      </Typography.Paragraph>
      <List
        dataSource={tasks}
        renderItem={(task, index) => (
          <List.Item>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text strong>
                  任务 {index + 1} · {task.title || '未命名'}
                </Typography.Text>
                <Checkbox checked={task.completed} onChange={(e) => onChange(index, { completed: e.target.checked })}>
                  标记完成
                </Checkbox>
              </Space>
              <Input
                value={task.title}
                placeholder="任务标题"
                onChange={(e) => onChange(index, { title: e.target.value })}
              />
              <Input.TextArea
                rows={2}
                value={task.description}
                placeholder="简述 / 交付物"
                onChange={(e) => onChange(index, { description: e.target.value })}
              />
              <Space style={{ width: '100%' }}>
                <Select
                  style={{ minWidth: 160, flex: 1 }}
                  placeholder="所属清单"
                  value={task.projectId || undefined}
                  onChange={(value) => onChange(index, { projectId: value })}
                  options={projects.map((p) => ({ value: p.id, label: p.name || '未命名清单' }))}
                />
                <Select
                  style={{ minWidth: 120, flex: 1 }}
                  placeholder="优先级"
                  value={task.priority}
                  onChange={(value) => onChange(index, { priority: value as TaskItem['priority'] })}
                  options={priorityOptions}
                />
              </Space>
            </Space>
          </List.Item>
        )}
      />
      {!tasks.length ? <Typography.Text type="secondary">暂无任务需要提交</Typography.Text> : null}
    </Modal>
  );
}
