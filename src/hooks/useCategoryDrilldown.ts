import { useCallback, useState } from 'react'
import { getAllCategories, getSubCategories, getSubSubCategories, type ApiCategory } from '../services/api'
import { categoryImageFrom, normalizeApiImage, pickImage } from '../services/images'

export type DrilldownItem = { id: string; name: string; image: string }

export function useCategoryDrilldown() {
  const [initializing, setInitializing] = useState(false)
  const [rootCategoryId, setRootCategoryId] = useState<string | null>(null)
  const [rootCategory, setRootCategory] = useState<{ id: string; name: string } | null>(null)

  const [subCats, setSubCats] = useState<DrilldownItem[]>([])
  const [subCatsLoading, setSubCatsLoading] = useState(false)

  const [activeSubCat, setActiveSubCat] = useState<{ id: string; name: string } | null>(null)

  const [subSubCats, setSubSubCats] = useState<DrilldownItem[]>([])
  const [subSubCatsLoading, setSubSubCatsLoading] = useState(false)

  const initializeByCategoryNameRegex = useCallback(async (regex: RegExp) => {
    if (initializing) return
    try {
      setInitializing(true)
      const res = await getAllCategories()
      const arr = Array.isArray(res) ? (res as ApiCategory[]) : []
      const found = arr.find((c) => {
        const name = String((c as any)?.title || (c as any)?.name || '').toLowerCase()
        return regex.test(name)
      })
      if (found) {
        const id = String((found as any)?.id ?? (found as any)?.category_id ?? '')
        const name = String((found as any)?.title || (found as any)?.name || 'Category')
        setRootCategoryId(id)
        setRootCategory({ id, name })
        await loadSubCats(id)
      } else {
        setRootCategoryId(null)
        setRootCategory(null)
        setSubCats([])
      }
    } finally {
      setInitializing(false)
    }
  }, [initializing])

  const loadSubCats = useCallback(async (catId: string) => {
    try {
      setSubCatsLoading(true)
      setActiveSubCat(null)
      setSubSubCats([])
      const res = await getSubCategories(catId)
      const arr = Array.isArray(res) ? res : []
      const mapped = arr.map((sc: any, i: number) => ({
        id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
        name: String(sc?.sub_title || sc?.title || sc?.name || 'Sub Category'),
        image: categoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || '/gapa-logo.png'
      }))
      setSubCats(mapped)
    } catch (_) {
      setSubCats([])
    } finally {
      setSubCatsLoading(false)
    }
  }, [])

  const selectSubCat = useCallback(async (subCat: { id: string; name: string }) => {
    setActiveSubCat(subCat)
    try {
      setSubSubCatsLoading(true)
      const res = await getSubSubCategories(subCat.id)
      const arr = Array.isArray(res) ? res : []
      const mapped = arr.map((ssc: any, i: number) => ({
        id: String(ssc?.sub_sub_cat_id ?? ssc?.id ?? ssc?.sub_sub_category_id ?? ssc?.subsubcatID ?? i),
        name: String(ssc?.sub_sub_title || ssc?.title || ssc?.name || 'Type'),
        image: categoryImageFrom(ssc) || normalizeApiImage(pickImage(ssc) || '') || '/gapa-logo.png'
      }))
      setSubSubCats(mapped)
    } catch (_) {
      setSubSubCats([])
    } finally {
      setSubSubCatsLoading(false)
    }
  }, [])

  return {
    initializing,
    rootCategoryId,
    rootCategory,
    subCats,
    subCatsLoading,
    activeSubCat,
    setActiveSubCat,
    subSubCats,
    subSubCatsLoading,
    initializeByCategoryNameRegex,
    loadSubCats,
    selectSubCat,
  }
}
