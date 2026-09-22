import { supabase } from '@/plugins/supabaseClient'

export type IngredientArticleStatus = 'haram' | 'syubhah' | 'muslim_friendly'

export interface IngredientArticleListItem {
  id: string
  slug: string
  status: IngredientArticleStatus
  title: string
  summary: string
  highlight_keyword: string | null
  image_url: string | null
  image_credit: string | null
}

export interface IngredientArticleAlias {
  id: string
  alias_en: string
  alias_zh_hant: string | null
  alias_type: 'synonym' | 'e_number' | 'brand'
}

export interface IngredientArticleSource {
  id: string
  organization: string
  url: string | null
  stance: 'haram' | 'permissible' | 'disputed'
  note: string | null
  sort_order: number
}

export interface IngredientArticleProductExample {
  id: string
  example: string
}

export interface IngredientArticleDetail extends IngredientArticleListItem {
  body: string
  aliases: IngredientArticleAlias[]
  sources: IngredientArticleSource[]
  products: IngredientArticleProductExample[]
}

export async function fetchIngredientArticles(status?: IngredientArticleStatus): Promise<IngredientArticleListItem[]> {
  let query = supabase
    .from('ingredient_articles')
    .select('id, slug, status, title, summary, highlight_keyword, image_url, image_credit')
    .order('title', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchIngredientArticleBySlug(slug: string): Promise<IngredientArticleDetail | null> {
  const { data: article, error } = await supabase
    .from('ingredient_articles')
    .select('id, slug, status, title, summary, body, highlight_keyword, image_url, image_credit')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!article) return null

  const [{ data: aliases }, { data: sources }, { data: products }] = await Promise.all([
    supabase.from('ingredient_article_aliases').select('id, alias_en, alias_zh_hant, alias_type').eq('article_id', article.id),
    supabase.from('ingredient_article_sources').select('id, organization, url, stance, note, sort_order').eq('article_id', article.id).order('sort_order', { ascending: true }),
    supabase.from('ingredient_article_products').select('id, example').eq('article_id', article.id)
  ])

  return {
    ...article,
    aliases: aliases || [],
    sources: sources || [],
    products: products || []
  }
}
