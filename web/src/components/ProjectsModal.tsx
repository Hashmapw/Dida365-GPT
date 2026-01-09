import { Modal, Tag, Typography, Space, Button, Empty, Spin, Tree } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Project } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
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

export function ProjectsModal({
  open,
  onClose,
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
  return (
    <Modal open={open} onCancel={onClose} title="可用清单列表" footer={null} width={680} destroyOnClose>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space align="center">
          <Typography.Text type={statusText ? 'secondary' : undefined}>{statusText}</Typography.Text>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新列表
          </Button>
        </Space>
        {loading ? <Spin /> : null}
        {!loading && projects.length ? (
          <Tree
            checkable
            selectable={false}
            checkedKeys={checkedTaskIds}
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
                <Typography.Text>{nodeData.title}</Typography.Text>
                {projectStatus[nodeData.key] ? (
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
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
    </Modal>
  );
}
