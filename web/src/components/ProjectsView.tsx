import React from 'react';
import { Card, Typography, Space, Button, Empty, Spin, Tree } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Project } from '../types';
import { StatusTag } from './SubmissionsView';
import { PageHeader } from './PageHeader';

interface Props {
  projects: Project[];
  loading: boolean;
  statusText: string;
  onRefresh: () => void;
  treeData: any[];
  checkedTaskIds: string[];
  onToggleTask: (taskId: string, checked: boolean) => void;
  onExpandProject: (projectId: string) => void;
  loadingProjectId: string | null;
  projectStatus: Record<string, string>;
}

export function ProjectsView({
  projects,
  loading,
  statusText,
  onRefresh,
  treeData,
  checkedTaskIds,
  onToggleTask,
  onExpandProject,
  loadingProjectId,
  projectStatus,
}: Props) {
  const extra = (
    <Button icon={<ReloadOutlined />} onClick={onRefresh}>
      刷新列表
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Project Explorer"
        subtitle="管理您的滴答清单项目与任务，实时预览 Markdown 转换后的任务归属与状态。"
        eyebrow="Synchronization"
        extra={extra}
      />
      <Card className="card" bordered={false} style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {statusText && (
            <Typography.Text type="secondary" style={{ fontSize: 16 }}>{statusText}</Typography.Text>
          )}
          {loading ? <Spin /> : null}
          {!loading && projects.length ? (
            <Tree
              checkable
              selectable={false}
              checkedKeys={checkedTaskIds}
              style={{ fontSize: 16, lineHeight: '2.2' }}
              onExpand={(keys, info) => {
                const keyStr = info.node.key as string;
                if (info.node.nodeType === 'project') {
                  onExpandProject(keyStr);
                }
              }}
              onCheck={(keys, info) => {
                const keyStr = info.node.key as string;
                if (info.node.children && info.node.children.length) return;
                if (info.node.disableCheckbox) return;
                onToggleTask(keyStr, info.checked as boolean);
              }}
              treeData={treeData}
              titleRender={(nodeData: any) => (
                <Space align="center">
                  {nodeData.nodeType === 'project' ? (
                    <span
                      className="tree-project-dot"
                      style={{
                        background: nodeData.color || '#d9d9d9',
                        borderColor: nodeData.color || '#d9d9d9',
                      }}
                    />
                  ) : null}
                  <Typography.Text style={{ fontSize: 16 }}>{nodeData.title}</Typography.Text>
                  {nodeData.nodeType === 'task' && nodeData.taskStatus != null ? (
                    <StatusTag entry={{ status: nodeData.taskStatus, completedTime: nodeData.taskCompletedTime }} />
                  ) : null}
                  {projectStatus[nodeData.key] ? (
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 14 }}>
                      {projectStatus[nodeData.key]}
                    </Typography.Text>
                  ) : null}
                  {loadingProjectId === nodeData.key ? <Spin size="small" /> : null}
                </Space>
              )}
            />
          ) : null}
          {!loading && !projects.length ? <Empty description="暂无清单，请先完成授权" /> : null}
        </Space>
      </Card>
    </>
  );
}