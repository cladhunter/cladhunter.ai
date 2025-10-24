import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase/client';

interface TodoRecord {
  id: string;
  title?: string | null;
  description?: string | null;
  created_at?: string | null;
}

export function TodoList() {
  const [todos, setTodos] = useState<TodoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTodos = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('todos')
          .select('*')
          .order('id', { ascending: true });

        if (!isMounted) {
          return;
        }

        if (queryError) {
          throw queryError;
        }

        const normalised = ((data ?? []) as Array<Record<string, unknown>>).flatMap((item) => {
          if (!item) {
            return [];
          }

          const rawId = item.id;
          const id =
            typeof rawId === 'string'
              ? rawId
              : typeof rawId === 'number'
              ? String(rawId)
              : null;

          if (!id) {
            return [];
          }

          const todo: TodoRecord = {
            id,
            title: typeof item.title === 'string' ? item.title : null,
            description:
              typeof item.description === 'string' ? item.description : null,
            created_at:
              typeof item.created_at === 'string' ? item.created_at : null,
          };

          return [todo];
        });

        setTodos(normalised);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('Failed to fetch todos from Supabase:', message);
        setError(message);
        setTodos([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchTodos();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div className="text-white/60">Loading todos…</div>;
  }

  if (error) {
    return (
      <div role="alert" className="text-red-400">
        Failed to load todos: {error}
      </div>
    );
  }

  if (todos.length === 0) {
    return <div className="text-white/60">No todos available.</div>;
  }

  return (
    <ul className="space-y-2 text-sm text-white/80">
      {todos.map((todo) => {
        const label = todo.title ?? todo.description ?? `Todo ${todo.id}`;
        return (
          <li key={todo.id} className="rounded-md bg-white/5 px-4 py-3 backdrop-blur">
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export default TodoList;
