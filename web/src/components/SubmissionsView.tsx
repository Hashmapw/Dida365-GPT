import React from 'react';
import { App as AntdApp, Typography, Space, Empty, Button, Spin, Tag, Table, Flex, Segmented, Descriptions, Card } from 'antd';
import dayjs from 'dayjs';
import { ReloadOutlined, SyncOutlined, CopyOutlined } from '@ant-design/icons';
import { SubmissionEntry, SyncStatus } from '../types';
import { PageHeader } from './PageHeader';

interface Props {
  entries: SubmissionEntry[];
  loading: boolean;
  onRefresh: () => void;
  range: '1d' | '3d' | '7d' | '30d' | 'all';
  onRangeChange: (val: '1d' | '3d' | '7d' | '30d' | 'all') => void;
  syncing?: boolean;
  onSync?: () => void;
  syncStatus?: SyncStatus | null;
}

export function SubmissionsView({ entries, loading, onRefresh, range, onRangeChange, syncing, onSync, syncStatus }: Props) {
  const { message } = AntdApp.useApp();

  const handleCopyId = async (id?: string, label = 'ID') => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      message.success(`${label}已复制`);
    } catch (_error) {
      message.error('复制失败，请手动复制');
    }
  };

  const lastSyncText = syncStatus?.lastSyncAt
    ? `上次同步: ${formatDateTime(syncStatus.lastSyncAt)} (${syncStatus.tasksSynced} 成功, ${syncStatus.tasksFailed} 失败)`
    : null;

  const extra = (
    <Space wrap>
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
      <Button icon={<ReloadOutlined />} onClick={() => onRefresh()}>
        刷新
      </Button>
      {onSync && (
        <Button icon={<SyncOutlined spin={syncing} />} onClick={onSync} loading={syncing}>
          同步
        </Button>
      )}
    </Space>
  );

  return (
    <>
      <PageHeader
        title="History & Logs"
        subtitle="查看 AI 处理历史与滴答清单同步状态，追溯每一次任务的生成与流转细节。"
        eyebrow="Data Persistence"
        extra={extra}
      />
      
      <Card className="card" bordered={false} style={{ marginTop: 24 }}>
        {lastSyncText && (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            {lastSyncText}
          </Typography.Text>
        )}
        {loading ? (
          <Spin />
        ) : entries.length ? (
          <Table
            rowKey={(row) => row.id || `${row.projectId || 'unknown'}-${row.title || 'row'}`}
            dataSource={[...entries].reverse()}
            pagination={{ pageSize: 20 }}
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
                        onClick={(e) => { e.stopPropagation(); handleCopyId(item.id, '任务 ID'); }}
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
                  <Space size={4}>
                    <Typography.Text type="secondary">{value || '未知清单'}</Typography.Text>
                    {item.projectId && (
                      <CopyOutlined
                        style={{ fontSize: 12, color: '#999', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); handleCopyId(item.projectId, '清单 ID'); }}
                      />
                    )}
                  </Space>
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
      </Card>
    </>
  );
}

function ExpandedContent({ entry }: { entry: SubmissionEntry }) {
  return (
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="原始">
        {entry.originalContent ? (
          <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{entry.originalContent}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">（无记录）</Typography.Text>
        )}
      </Descriptions.Item>
      <Descriptions.Item label="提交">
        <ParsedJsonTable content={entry.aiPolishedContent} />
      </Descriptions.Item>
      <Descriptions.Item label="最新">
        <ParsedJsonTable content={entry.latestSyncedContent} />
      </Descriptions.Item>
    </Descriptions>
  );
}

function ParsedJsonTable({ content }: { content?: string | null }) {
  if (!content) {
    return <Typography.Text type="secondary">（无记录）</Typography.Text>;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Typography.Text>;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{String(parsed)}</Typography.Text>;
  }

  const hiddenFields = new Set(['id', 'projectId', 'projectName', 'sortOrder', 'kind', 'etag', 'createdTime', 'modifiedTime']);

  const fieldMap: Record<string, string> = {
    title: '标题',
    description: '描述',
    desc: '描述',
    content: '内容',
    priority: '优先级',
    status: '状态',
    dueDate: '截止日期',
    startDate: '开始日期',
    isAllDay: '全天任务',
    isFloating: '浮动任务',
    completed: '状态',
    completedTime: '完成时间',
    items: '子任务',
    subTasks: '子任务',
    reminders: '提醒',
    repeatFlag: '重复规则',
    timeZone: '时区',
    scheduleMode: '日程模式',
    tags: '标签',
    progress: '进度',
    assignee: '执行者',
    exDate: '排除日期',
    completedUserId: '完成者',
    focusSummaries: '专注摘要',
    columnId: '看板列',
    parentId: '父任务',
  };

  const priorityMap: Record<number, string> = { 0: '无', 1: '低', 3: '中', 5: '高' };
  const statusMap: Record<number, string> = { 0: '未完成', 1: '进行中', 2: '已完成' };

  function formatValue(key: string, val: any): React.ReactNode {
    if (val === null || val === undefined || val === '') return '-';
    if (key === 'completed') {
      return val ? '已完成' : '未完成';
    }
    if (key === 'priority' && typeof val === 'number') {
      return priorityMap[val] ?? String(val);
    }
    if (key === 'status' && typeof val === 'number') {
      return statusMap[val] ?? String(val);
    }
    if (typeof val === 'boolean' || key === 'isAllDay' || key === 'isFloating') {
      return val ? '是' : '否';
    }
    if ((key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) && typeof val === 'string' && val.length >= 10) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        }
      } catch { /* fall through */ }
    }
    if (Array.isArray(val)) {
      if (!val.length) return '（空）';
      if (key === 'items' || key === 'subTasks') {
        return (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {val.map((item: any, i: number) => (
              <li key={i}>
                {item.title || item.name || JSON.stringify(item)}
                {item.status === 2 ? ' ✓' : ''}
              </li>
            ))}
          </ul>
        );
      }
      return <Typography.Text code>{JSON.stringify(val)}</Typography.Text>;
    }
    if (typeof val === 'object') {
      return <Typography.Text code>{JSON.stringify(val)}</Typography.Text>;
    }
    return String(val);
  }

  const dataSource = Object.entries(parsed)
    .filter(([key, v]) => !hiddenFields.has(key) && v !== null && v !== undefined && v !== '')
    .map(([key, value]) => ({
      key,
      label: fieldMap[key] || key,
      value,
    }));

  if (!dataSource.length) {
    return <Typography.Text type="secondary">（空对象）</Typography.Text>;
  }

  return (
    <Table
      dataSource={dataSource}
      columns={[
        {
          title: '字段',
          dataIndex: 'label',
          width: 120,
          render: (text) => <Typography.Text type="secondary">{text}</Typography.Text>,
        },
        {
          title: '值',
          dataIndex: 'value',
          render: (_val, record) => formatValue(record.key, record.value),
        }
      ]}
      pagination={false}
      size="small"
      showHeader={false}
      bordered
      style={{ maxWidth: 800 }}
    />
  );
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