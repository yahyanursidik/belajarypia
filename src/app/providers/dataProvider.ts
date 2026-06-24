import type {
  BaseRecord,
  CreateParams,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  GetOneParams,
  UpdateParams,
} from "@refinedev/core";
import { supabase } from "../../lib/supabase";

const toData = <TData extends BaseRecord>(data: unknown) => data as TData;
const toDataList = <TData extends BaseRecord>(data: unknown) => data as TData[];

type QueryError = { message: string };
type QueryResponse<TData> = {
  data: TData | null;
  count?: number | null;
  error: QueryError | null;
};
type SelectQuery = {
  eq: (field: string, value: unknown) => SelectQuery;
  order: (field: string, options: { ascending: boolean }) => SelectQuery;
  range: (from: number, to: number) => PromiseLike<QueryResponse<unknown[]>>;
  single: () => PromiseLike<QueryResponse<unknown>>;
};
type MutationQuery = {
  eq: (field: string, value: unknown) => MutationQuery;
  select: (columns: string) => {
    single: () => PromiseLike<QueryResponse<unknown>>;
  };
};
type TableQuery = {
  select: (columns: string, options?: { count: "exact" }) => SelectQuery;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => MutationQuery;
  update: (values: Record<string, unknown>) => MutationQuery;
  delete: () => MutationQuery;
};

function table(resource: string) {
  return supabase.from(resource) as unknown as TableQuery;
}

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
    pagination,
    sorters,
    filters,
  }: GetListParams) => {
    const paginationState = pagination as
      | { current?: number; currentPage?: number; pageSize?: number }
      | undefined;
    const current = paginationState?.current ?? paginationState?.currentPage ?? 1;
    const pageSize = paginationState?.pageSize ?? 10;
    const from = (current - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = table(resource).select("*", { count: "exact" });

    filters?.forEach((filter) => {
      if ("field" in filter && filter.operator === "eq") {
        query = query.eq(filter.field, filter.value);
      }
    });

    sorters?.forEach((sorter) => {
      query = query.order(sorter.field, { ascending: sorter.order === "asc" });
    });

    const { data, count, error } = await query.range(from, to);

    if (error) {
      throw error;
    }

    return {
      data: toDataList<TData>(data ?? []),
      total: count ?? 0,
    };
  },
  getOne: async <TData extends BaseRecord = BaseRecord>({
    resource,
    id,
  }: GetOneParams) => {
    const { data, error } = await table(resource).select("*").eq("id", id).single();

    if (error) {
      throw error;
    }

    return { data: toData<TData>(data) };
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    variables,
  }: CreateParams<TVariables>) => {
    const { data, error } = await table(resource)
      .insert(variables as Record<string, unknown>)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { data: toData<TData>(data) };
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    id,
    variables,
  }: UpdateParams<TVariables>) => {
    const { data, error } = await table(resource)
      .update(variables as Record<string, unknown>)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { data: toData<TData>(data) };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>({
    resource,
    id,
  }: DeleteOneParams<TVariables>) => {
    const { data, error } = await table(resource)
      .delete()
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { data: toData<TData>(data) };
  },
  getApiUrl: () => "supabase",
};
