import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const COLS = 'id, argus_call_id, argus_user_id, operator_name, call_started_at, duration_seconds, call_result, tabulation, human_review_status, call_evaluations(score, result, criteria, notes)';

// Carrega as ligações do dia (horário de São Paulo). O RLS do Supabase limita o que cada cargo enxerga.
export function useCalls(date) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' });
  const reload = useCallback(async () => {
    if (!supabase) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const from = `${date}T00:00:00-03:00`;
    const to = `${date}T23:59:59.999-03:00`;
    const rows = [];
    for (let start = 0; start < 20000; start += 1000) {
      const { data, error } = await supabase.from('call_records').select(COLS)
        .gte('call_started_at', from).lte('call_started_at', to)
        .order('call_started_at', { ascending: false }).range(start, start + 999);
      if (error) { setState({ rows: [], loading: false, error: error.message }); return; }
      rows.push(...data);
      if (data.length < 1000) break;
    }
    setState({ rows, loading: false, error: '' });
  }, [date]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
