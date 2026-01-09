import React, { useEffect, useRef, useState } from 'react';
import { App as AntdApp, Modal, Typography, Space, Empty, Button, Spin, Tag, Table, Switch, Flex } from 'antd';
import dayjs from 'dayjs';
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
  const { message } = AntdApp.useApp();
  const visibleEntries = entries.filter((item) => item.latestTask);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoRefresh || !open) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setProgress(0);
      return;
    }
    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + 100 / 60;
        if (next >= 100) {
          onRefresh();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, open, onRefresh]);

  const spinPercent = (autoRefresh ? 'auto' : progress) as any;

  const handleCopyId = async (taskId?: string) => {
    if (!taskId) return;
    try {
      await navigator.clipboard.writeText(taskId);
      message.success('任务 ID 已复制');
    } catch (_error) {
      message.error('复制失败，请手动复制');
    }
  };

  return (
    <Modal open={open} onCancel={onClose} title="提交记录" footer={null} width={1100} destroyOnClose>
      <Flex align="center" gap="middle" style={{ marginBottom: 12 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setProgress(0);
            onRefresh();
          }}
        >
          刷新
        </Button>
        <Switch
          checkedChildren="自动刷新"
          unCheckedChildren="自动刷新"
          checked={autoRefresh}
          onChange={() => {
            setAutoRefresh((v) => !v);
            setProgress(0);
          }}
        />
        <Spin percent={spinPercent} size="small" />
        <Typography.Text type="secondary">每 1 分钟自动刷新</Typography.Text>
      </Flex>
      {loading ? (
        <Spin />
      ) : visibleEntries.length ? (
        <Table
          rowKey={(row) => row.id || `${row.projectId || 'unknown'}-${row.title || 'row'}`}
          dataSource={[...visibleEntries].reverse()}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: '任务',
              render: (_value, item) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text
                    strong
                    style={{ cursor: item.id ? 'pointer' : 'default' }}
                    onClick={() => handleCopyId(item.id)}
                  >
                    {item.title || item.latestTask?.title || '未命名任务'}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: '状态',
              width: 100,
              render: (_value, item) => (item.latestTask ? <StatusTag task={item.latestTask} /> : null),
            },
            {
              title: '所属清单',
              dataIndex: 'projectName',
              width: 100,
              render: (value: string | undefined, item) => (
                <Typography.Text type="secondary">{value || item.projectId || '未知清单'}</Typography.Text>
              ),
            },
            {
              title: '时间',
              width: 240,
              render: (_value, item) => renderSchedule(item.latestTask),
            },
            {
              title: '创建时间',
              width: 200,
              render: (_value, item) =>
                item.createdAt ? (
                  <Typography.Text type="secondary">{formatDateTime(item.createdAt)}</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                ),
            },
            {
              title: '完成时间',
              width: 200,
              render: (_value, item) =>
                item.latestTask?.completedTime ? (
                  <Typography.Text type="secondary">{formatDateTime(item.latestTask.completedTime)}</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">-</Typography.Text>
                ),
            },
          ]}
          locale={{ emptyText: <Empty description="暂无提交记录" /> }}
        />
      ) : (
        <Empty description="暂无提交记录" />
      )}
    </Modal>
  );
}

function StatusTag({ task }: { task: any }) {
  const completed = task?.status === 2 || Boolean(task?.completedTime);
  const color = completed ? 'green' : 'orange';
  const label = completed ? '已完成' : '未完成';
  return <Tag color={color}>{label}</Tag>;
}

function renderSchedule(task?: any) {
  if (!task) return <Typography.Text type="secondary">-</Typography.Text>;
  const { startDate, dueDate, isAllDay } = task || {};
  if (!startDate && !dueDate) return <Typography.Text type="secondary">-</Typography.Text>;
  if (startDate && dueDate) {
    const startKey = normalizeForCompare(startDate);
    const dueKey = normalizeForCompare(dueDate);
    if (startKey === dueKey) {
      return <Typography.Text type="secondary">{formatDateTime(dueDate, isAllDay)}</Typography.Text>;
    }
    // 全天：仅日期区间；非全天：日期时间区间
    return (
      <Typography.Text type="secondary">
        {formatDateTime(startDate, isAllDay)} ~ {formatDateTime(dueDate, isAllDay)}
      </Typography.Text>
    );
  }
  // 只有一个时间点
  const value = dueDate || startDate;
  if (!value) return <Typography.Text type="secondary">-</Typography.Text>;
  return <Typography.Text type="secondary">{formatDateTime(value, isAllDay)}</Typography.Text>;
}

function formatDateTime(value?: string, isAllDay = false) {
  if (!value) return '-';
  // Normalize timezone offset like +0000 -> +00:00 for parsing
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = dayjs(normalized);
  if (parsed.isValid()) {
    if (isAllDay || !value.includes('T')) {
      return parsed.format('YYYY-MM-DD');
    }
    return parsed.format('YYYY-MM-DD HH:mm:ss');
  }
  return normalized.replace('T', ' ').replace(/\.\d+/, '');
}

function normalizeForCompare(value?: string) {
  if (!value) return '';
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.valueOf() : normalized;
}
