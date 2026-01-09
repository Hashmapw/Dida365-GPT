import React from 'react';
import { DeleteOutlined, CalendarOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Input, Segmented, Select, Space, Switch, Typography, DatePicker, Popover, Tag } from 'antd';
import TextArea from 'antd/es/input/TextArea';
import dayjs, { Dayjs } from 'dayjs';
import { Project, TaskItem } from '../types';

const priorityOptions = [
  { value: 'high', label: '高优先级', color: '#DC2626' },
  { value: 'medium', label: '中优先级', color: '#EA8A1A' },
  { value: 'low', label: '低优先级', color: '#2563EB' },
  { value: 'none', label: '无优先级', color: '#9CA3AF' },
] as const;

interface Props {
  task: TaskItem;
  index: number;
  projects: Project[];
  onChange: (index: number, updates: Partial<TaskItem>) => void;
  onRemove: (index: number) => void;
}

export function TaskCard({ task, index, projects, onChange, onRemove }: Props) {
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name || '未命名清单',
    color: project.color,
  }));

  return (
    <Card size="small" className="task-card" bordered>
      <header>
        <Typography.Text strong>{`任务 ${index + 1}`}</Typography.Text>
        <Space>
          <Checkbox checked={task.completed} onChange={(e) => onChange(index, { completed: e.target.checked })}>
            标记完成
          </Checkbox>
          <Button danger icon={<DeleteOutlined />} onClick={() => onRemove(index)} size="small">
            删除
          </Button>
        </Space>
      </header>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Input
          placeholder="任务标题"
          value={task.title}
          onChange={(e) => onChange(index, { title: e.target.value })}
        />
        <TextArea
          rows={4}
          placeholder="详细说明 / 交付物，可使用 Markdown"
          value={task.description}
          onChange={(e) => onChange(index, { description: e.target.value })}
        />

        <div className="task-meta">
          <div className="task-meta-field">
            <Typography.Text type="secondary">所属清单</Typography.Text>
            <Select
              allowClear
              showSearch
              placeholder="选择清单"
              value={task.projectId || undefined}
              onChange={(value) => onChange(index, { projectId: value || '' })}
              optionFilterProp="label"
              style={{ width: '100%' }}
              options={projectOptions.map((item) => ({
                value: item.value,
                label: (
                  <Space>
                    {item.color ? <span className="project-dot" style={{ background: item.color }} /> : null}
                    <span>{item.label}</span>
                  </Space>
                ),
              }))}
            />
          </div>

          <div className="task-meta-field">
            <Typography.Text type="secondary">优先级</Typography.Text>
            <Select
              value={task.priority}
              onChange={(value) => onChange(index, { priority: value as TaskItem['priority'] })}
              style={{ width: '100%' }}
              options={priorityOptions.map((item) => ({
                value: item.value,
                label: (
                  <Space>
                    <Tag color={item.color} bordered={false} style={{ minWidth: 52, textAlign: 'center' }}>
                      {item.label}
                    </Tag>
                  </Space>
                ),
              }))}
            />
          </div>

          <div className="task-meta-field">
            <Typography.Text type="secondary">计划时间</Typography.Text>
            <SchedulePopover task={task} onChange={(updates) => onChange(index, updates)} />
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">子任务</Typography.Text>
          <TextArea
            rows={3}
            value={task.subTasks?.join('\n') || ''}
            placeholder={`子任务 1
子任务 2`}
            onChange={(e) =>
              onChange(index, {
                subTasks: e.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
          {task.suggestedDueDate && !task.dueDate ? (
            <Typography.Text type="secondary">AI 建议：{task.suggestedDueDate}</Typography.Text>
          ) : null}
        </div>
      </Space>
    </Card>
  );
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const direct = dayjs(value);
  if (direct.isValid()) return direct;
  const fallback = dayjs(value, 'YYYY-MM-DD', true);
  return fallback.isValid() ? fallback : null;
}

function serializeDate(value: Dayjs | null, allDay: boolean) {
  if (!value) return '';
  return allDay ? value.format('YYYY-MM-DD') : value.format('YYYY-MM-DDTHH:mm');
}

function hasDateOnlyValue(value = '') {
  if (!value) return false;
  return !value.includes('T');
}

function SchedulePopover({ task, onChange }: { task: TaskItem; onChange: (updates: Partial<TaskItem>) => void }) {
  const [open, setOpen] = React.useState(false);
  const inferAllDay = (t: TaskItem) => {
    if (typeof t.isAllDay === 'boolean') return t.isAllDay;
    if (hasDateOnlyValue(t.dueDate) || hasDateOnlyValue(t.startDate)) return true;
    return false;
  };

  const [mode, setMode] = React.useState<TaskItem['scheduleMode']>(task.scheduleMode === undefined ? 'point' : task.scheduleMode);
  const [allDay, setAllDay] = React.useState<boolean>(inferAllDay(task));
  const [start, setStart] = React.useState<Dayjs | null>(parseDate(task.startDate));
  const [end, setEnd] = React.useState<Dayjs | null>(parseDate(task.dueDate));

  React.useEffect(() => {
    // 保留 'none' 模式，只有在 undefined 时才默认为 'point'
    setMode(task.scheduleMode === undefined ? 'point' : task.scheduleMode);
    setAllDay(inferAllDay(task));
    setStart(parseDate(task.startDate));
    setEnd(parseDate(task.dueDate));
  }, [task.scheduleMode, task.isAllDay, task.startDate, task.dueDate]);

  React.useEffect(() => {
    if ((task.scheduleMode ?? 'point') === 'none') {
      setOpen(false);
      setStart(null);
      setEnd(null);
    }
  }, [task.scheduleMode]);

  React.useEffect(() => {
    if (mode === 'none') {
      setOpen(false);
      setStart(null);
      setEnd(null);
    }
  }, [mode]);

  const summary = React.useMemo(() => {
    if (mode === 'none') return '未设置';
    if (!end && !start) return '未设置';
    const format = allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm';
    if (mode === 'range') {
      return [start ? start.format(format) : '', end ? end.format(format) : ''].filter(Boolean).join(' → ') || '未设置';
    }
    return end ? end.format(format) : '未设置';
  }, [mode, allDay, start, end]);

  const handleClear = () => {
    setStart(null);
    setEnd(null);
    if (mode === 'range') {
      onChange({ scheduleMode: 'range', startDate: '', dueDate: '', isAllDay: allDay });
    } else if (mode === 'point') {
      onChange({ scheduleMode: 'point', startDate: '', dueDate: '', isAllDay: allDay });
    } else {
      onChange({ scheduleMode: 'none', startDate: '', dueDate: '', isAllDay: allDay });
      queueMicrotask(() => setOpen(false));
    }
  };

  const handleNow = () => {
    const now = dayjs();
    const nextAllDay = false;
    setAllDay(nextAllDay);
    if (mode === 'range') {
      setStart(now);
      setEnd(now);
      onChange({
        scheduleMode: 'range',
        startDate: serializeDate(now, nextAllDay),
        dueDate: serializeDate(now, nextAllDay),
        isAllDay: nextAllDay,
      });
    } else {
      setMode('point');
      setStart(null);
      setEnd(now);
      onChange({
        scheduleMode: 'point',
        startDate: '',
        dueDate: serializeDate(now, nextAllDay),
        isAllDay: nextAllDay,
      });
    }
  };

  const handleLater = () => {
    const now = dayjs();
    const minute = now.minute();
    const add = minute % 15 === 0 ? 0 : 15 - (minute % 15);
    const next = now.add(add, 'minute').second(0);
    const nextAllDay = false;
    setAllDay(nextAllDay);
    if (mode === 'range') {
      setStart(next);
      setEnd(next);
      onChange({
        scheduleMode: 'range',
        startDate: serializeDate(next, nextAllDay),
        dueDate: serializeDate(next, nextAllDay),
        isAllDay: nextAllDay,
      });
    } else {
      setMode('point');
      setStart(null);
      setEnd(next);
      onChange({
        scheduleMode: 'point',
        startDate: '',
        dueDate: serializeDate(next, nextAllDay),
        isAllDay: nextAllDay,
      });
    }
  };

  const handleToday = () => {
    const today = dayjs().startOf('day');
    setAllDay(true);
    if (mode === 'range') {
      setStart(today);
      setEnd(today);
      onChange({
        scheduleMode: 'range',
        startDate: today.format('YYYY-MM-DD'),
        dueDate: today.format('YYYY-MM-DD'),
        isAllDay: true,
      });
    } else {
      setMode('point');
      setStart(null);
      setEnd(today);
      onChange({
        scheduleMode: 'point',
        startDate: '',
        dueDate: today.format('YYYY-MM-DD'),
        isAllDay: true,
      });
    }
  };

  const apply = () => {
    if (mode === 'none') {
      onChange({ scheduleMode: 'none', startDate: '', dueDate: '', isAllDay: allDay });
      queueMicrotask(() => setOpen(false));
      return;
    }
    if (mode === 'point') {
      onChange({
        scheduleMode: 'point',
        startDate: '',
        dueDate: serializeDate(end, allDay),
        isAllDay: allDay,
      });
      queueMicrotask(() => setOpen(false));
      return;
    }
    onChange({
      scheduleMode: 'range',
      startDate: serializeDate(start, allDay),
      dueDate: serializeDate(end, allDay),
      isAllDay: allDay,
    });
    queueMicrotask(() => setOpen(false));
  };

  const content = (
    <div className="schedule-popover">
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Segmented
          block
          value={mode}
          onChange={(value) => {
            const next = value as TaskItem['scheduleMode'];
            setMode(next);
            if (next === 'none') {
              setStart(null);
              setEnd(null);
              onChange({ scheduleMode: 'none', startDate: '', dueDate: '', isAllDay: allDay });
              // 延迟关闭弹层，确保状态更新已提交
              queueMicrotask(() => setOpen(false));
            }
          }}
          options={[
            { label: '时间点', value: 'point' },
            { label: '时间段', value: 'range' },
            { label: '不设置', value: 'none' },
          ]}
        />
        {mode === 'point' && (
          <DatePicker
            showTime={!allDay ? { format: 'HH:mm' } : false}
            value={end}
            style={{ width: '100%' }}
            placeholder="选择截止时间"
            onChange={(value) => setEnd(value)}
            format={allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'}
          />
        )}
        {mode === 'range' && (
          <DatePicker.RangePicker
            showTime={!allDay ? { format: 'HH:mm' } : false}
            value={[start, end]}
            style={{ width: '100%' }}
            placeholder={['开始', '截止']}
            onChange={(values) => {
              const [startValue, endValue] = values || [];
              setStart(startValue);
              setEnd(endValue);
            }}
            format={allDay ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'}
          />
        )}
        {mode !== 'none' && (
          <div className="schedule-actions-row">
            <div className="schedule-row-line">
              <Space size={8}>
                <Button size="small" onClick={() => handleClear()}>
                  清除
                </Button>
                <Button size="small" onClick={() => handleNow()}>
                  现在
                </Button>
                <Button size="small" onClick={() => handleLater()}>
                  延后
                </Button>
                <Button size="small" onClick={() => handleToday()}>
                  今天
                </Button>
              </Space>
              <Space align="center">
                <Typography.Text type="secondary">全天</Typography.Text>
                <Switch checked={allDay} onChange={setAllDay} />
              </Space>
            </div>
            <Space size={8} align="center">
              <Button size="small" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="primary" size="small" onClick={apply}>
                保存
              </Button>
            </Space>
          </div>
        )}
      </Space>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={mode === 'none' ? false : open}
      onOpenChange={(val) => setOpen(val)}
      placement="bottomLeft"
    >
      <Button icon={<CalendarOutlined />} block>
        {summary}
      </Button>
    </Popover>
  );
}
