import { json } from '@sveltejs/kit';
import { queryAudit } from '../../../../../dispatch/audit';

export function GET({ url }) {
  const filter: Record<string, any> = {};

  const docPath = url.searchParams.get('doc_path');
  if (docPath) filter.doc_path = docPath;

  const actor = url.searchParams.get('actor');
  if (actor) filter.actor = actor;

  const actorType = url.searchParams.get('actor_type');
  if (actorType === 'human' || actorType === 'ai') filter.actor_type = actorType;

  const dateFrom = url.searchParams.get('date_from');
  if (dateFrom) filter.date_from = dateFrom;

  const dateTo = url.searchParams.get('date_to');
  if (dateTo) filter.date_to = dateTo;

  const transitionFrom = url.searchParams.get('transition_from');
  if (transitionFrom) filter.transition_from = transitionFrom;

  const transitionTo = url.searchParams.get('transition_to');
  if (transitionTo) filter.transition_to = transitionTo;

  const gateId = url.searchParams.get('gate_id');
  if (gateId) filter.gate_id = gateId;

  const gateStatus = url.searchParams.get('gate_status');
  if (gateStatus) filter.gate_status = gateStatus;

  const limit = url.searchParams.get('limit');
  if (limit) filter.limit = parseInt(limit, 10);

  const offset = url.searchParams.get('offset');
  if (offset) filter.offset = parseInt(offset, 10);

  const result = queryAudit(filter);
  return json(result);
}
