import React from 'react';
import { App as AntdApp, Modal, Typography, Space, Empty, Button, Spin, Tag, Table, Flex, Segmented, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { ReloadOutlined, SyncOutlined, CopyOutlined } from '@ant-design/icons';
import { SubmissionEntry, SyncStatus } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  entries: SubmissionEntry[];
  loading: boolean;
  onRefresh: () => void;
  range: '1d' | '3d' | '7d' | '30d' | 'all';
  onRangeChange: (val: '1d' | '3d' | '7d' | '30d' | 'all') => void;
  syncing?: boolean;
  onSync?: () => void;
  syncStatus?: SyncStatus | null;
}

export function SubmissionsModal({ open, onClose, entries, loading, onRefresh, range, onRangeChange, syncing, onSync, syncStatus }: Props) {
  const { message } = AntdApp.useApp();

  const handleCopyId = async (taskId?: string) => {
    if (!taskId) return;
    try {
      await navigator.clipboard.writeText(taskId);
      message.success('任务 ID 已复制');
    } catch (_error) {
      message.error('复制失败，请手动复制');
    }
  };

  const lastSyncText = syncStatus?.lastSyncAt
    ? `上次同步: ${formatDateTime(syncStatus.lastSyncAt)} (${syncStatus.tasksSynced} 成功, ${syncStatus.tasksFailed} 失败)`
    : null;

  return (
    <Modal open={open} onCancel={onClose} title="提交记录" footer={null} width={1100} destroyOnClose>
      <Flex align="center" gap="middle" style={{ marginBottom: 12 }} wrap="wrap">
        <Button
          icon={<ReloadOutlined />}
          onClick={() => onRefresh()}
        >
          刷新
        </Button>
        {onSync && (
          <Button icon={<SyncOutlined spin={syncing} />} onClick={onSync} loading={syncing}>
            同步
          </Button>
        )}
        <Segmented
          value={range}
          onChange={(val) => onRangeChange(val as any)}
          options={[
            { label: '近1天', value: '1d' },
            { label: '近3天', value: '3d' },
            { label: '近一周', value: '7d' },
            { label: '近一月', value: '30d' },
            { label: '全部', value: 'all' },
          ]}
        />
      </Flex>
      {lastSyncText && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          {lastSyncText}
        </Typography.Text>
      )}
      {loading ? (
        <Spin />
      ) : entries.length ? (
        <Table
          rowKey={(row) => row.id || `${row.projectId || 'unknown'}-${row.title || 'row'}`}
          dataSource={[...entries].reverse()}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender: (record) => <ExpandedContent entry={record} />,
            rowExpandable: () => true,
          }}
          columns={[
            {
              title: '任务',
              render: (_value, item) => (
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>
                    {item.title || '未命名任务'}
                  </Typography.Text>
                  {item.id && (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); handleCopyId(item.id); }}
                    >
                      <CopyOutlined style={{ marginRight: 4 }} />
                      {item.id}
                    </Typography.Text>
                  )}
                  {item.syncError && (
                    <Typography.Text type="danger" style={{ fontSize: 11 }}>
                      {item.syncError}
                    </Typography.Text>
                  )}
                </Space>
              ),
            },
            {
              title: '状态',
              width: 100,
              render: (_value, item) => <StatusTag entry={item} />,
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
              render: (_value, item) => renderSchedule(item),
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
                item.completedTime ? (
                  <Typography.Text type="secondary">{formatDateTime(item.completedTime)}</Typography.Text>
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

function ExpandedContent({ entry }: { entry: SubmissionEntry }) {
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="原始输入">
        {entry.originalContent ? (
          <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{entry.originalContent}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">（无记录）</Typography.Text>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="AI 整理">
        <ParsedJsonContent content={entry.aiPolishedContent} />
      </Descriptions.Item>
      <Descriptions.Item label="滴答最新">
        <ParsedJsonContent content={entry.latestSyncedContent} />
      </Descriptions.Item>
    </Descriptions>
  );
}

function ParsedJsonContent({ content }: { content?: string | null }) {
  if (!content) {
    return <Typography.Text type="secondary">（无记录）</Typography.Text>;
  }
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      const entries = Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined && v !== '');
      if (!entries.length) {
        return <Typography.Text type="secondary">（空对象）</Typography.Text>;
      }
      return (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {entries.map(([key, value]) => (
            <div key={key}>
              <Typography.Text strong style={{ fontSize: 12 }}>{key}: </Typography.Text>
              <Typography.Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </Typography.Text>
            </div>
          ))}
        </Space>
      );
    }
    return <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{String(parsed)}</Typography.Text>;
  } catch {
    return <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Typography.Text>;
  }
}

export function StatusTag({ entry }: { entry: { status?: number; completedTime?: string | null } }) {
  const completed = entry.status === 2 || Boolean(entry.completedTime);
  const color = completed ? 'green' : 'orange';
  const label = completed ? '已完成' : '未完成';
  return <Tag color={color}>{label}</Tag>;
}

function renderSchedule(entry: SubmissionEntry) {
  const { startDate, dueDate, isAllDay } = entry;
  if (!startDate && !dueDate) return <Typography.Text type="secondary">-</Typography.Text>;
  if (startDate && dueDate) {
    const startKey = normalizeForCompare(startDate);
    const dueKey = normalizeForCompare(dueDate);
    if (startKey === dueKey) {
      return <Typography.Text type="secondary">{formatDateTime(dueDate, isAllDay)}</Typography.Text>;
    }
    return (
      <Typography.Text type="secondary">
        {formatDateTime(startDate, isAllDay)} ~ {formatDateTime(dueDate, isAllDay)}
      </Typography.Text>
    );
  }
  const value = dueDate || startDate;
  if (!value) return <Typography.Text type="secondary">-</Typography.Text>;
  return <Typography.Text type="secondary">{formatDateTime(value, isAllDay)}</Typography.Text>;
}

function formatDateTime(value?: string | null, isAllDay = false) {
  if (!value) return '-';
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

function normalizeForCompare(value?: string | null) {
  if (!value) return '';
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.valueOf() : normalized;
}
