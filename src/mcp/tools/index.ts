import { McpTool } from '../types';
import { mutationTools } from './mutation_index';
import { transitionTools } from './transitions_index';
import { queryTools } from './query_index';
import { utilityTools } from './utility_index';
import { inventoryTools } from './inventory_index';
import { stepIssueTools } from './step_issues_index';
import { contributionTools } from './contribute_index';
import { frictionTools } from './friction_index';
import { issueWorkflowTools } from './issue_workflow_index';

export const allTools: McpTool[] = [
  ...mutationTools,
  ...transitionTools,
  ...queryTools,
  ...utilityTools,
  ...inventoryTools,
  ...stepIssueTools,
  ...contributionTools,
  ...frictionTools,
  ...issueWorkflowTools,
];
