import { Button, Card, Empty, Flex, Space, Typography } from 'antd';
import { ReloadOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons';
import { Project, TaskItem } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: TaskItem[];
  projects: Project[];
  onTaskChange: (index: number, updates: Partial<TaskItem>) => void;
  onRemoveTask: (index: number) => void;
  onAddTask: () => void;
  onClearTasks: () => void;
  onRefreshProjects: () => void;
}

export function TasksSection({
  tasks,
  projects,
  onTaskChange,
  onRemoveTask,
  onAddTask,
  onClearTasks,
  onRefreshProjects,
}: Props) {
  return (
    <Card
      title="2. 校对 / 编辑 AI 任务"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={onRefreshProjects}>
            刷新清单
          </Button>
          <Button icon={<ClearOutlined />} onClick={onClearTasks}>
            清空所有
          </Button>
        </Space>
      }
    >
      {!tasks.length ? (
        <Empty
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>还没有可编辑的任务</Typography.Text>
              <Typography.Text type="secondary">先运行「AI 整理」或「手动添加」</Typography.Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={onAddTask}>
                手动添加
              </Button>
            </Space>
          }
        />
      ) : (
        <Flex vertical gap={12} className="tasks-grid">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              projects={projects}
              onChange={onTaskChange}
              onRemove={onRemoveTask}
            />
          ))}
        </Flex>
      )}
    </Card>
  );
}
