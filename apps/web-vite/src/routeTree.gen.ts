/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ExploreRouteImport } from './routes/explore'
import { Route as WalksRouteImport } from './routes/walks'
import { Route as StoriesRouteImport } from './routes/stories'
import { Route as TodayRouteImport } from './routes/today'
import { Route as ArRouteImport } from './routes/ar'
import { Route as AboutRouteImport } from './routes/about'
import { Route as AdminIndexRouteImport } from './routes/admin/index'
import { Route as AdminBusinessesRouteImport } from './routes/admin/businesses'
import { Route as PagesIndexRouteImport } from './routes/pages/index'
import { Route as PagesSlugRouteImport } from './routes/pages/$slug'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const ExploreRoute = ExploreRouteImport.update({ id: '/explore', path: '/explore', getParentRoute: () => rootRouteImport } as any)
const WalksRoute = WalksRouteImport.update({ id: '/walks', path: '/walks', getParentRoute: () => rootRouteImport } as any)
const StoriesRoute = StoriesRouteImport.update({ id: '/stories', path: '/stories', getParentRoute: () => rootRouteImport } as any)
const TodayRoute = TodayRouteImport.update({ id: '/today', path: '/today', getParentRoute: () => rootRouteImport } as any)
const ArRoute = ArRouteImport.update({ id: '/ar', path: '/ar', getParentRoute: () => rootRouteImport } as any)
const AboutRoute = AboutRouteImport.update({ id: '/about', path: '/about', getParentRoute: () => rootRouteImport } as any)
const AdminIndexRoute = AdminIndexRouteImport.update({ id: '/admin/', path: '/admin/', getParentRoute: () => rootRouteImport } as any)
const AdminBusinessesRoute = AdminBusinessesRouteImport.update({ id: '/admin/businesses', path: '/admin/businesses', getParentRoute: () => rootRouteImport } as any)
const PagesIndexRoute = PagesIndexRouteImport.update({ id: '/pages/', path: '/pages/', getParentRoute: () => rootRouteImport } as any)
const PagesSlugRoute = PagesSlugRouteImport.update({ id: '/pages/$slug', path: '/pages/$slug', getParentRoute: () => rootRouteImport } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/explore': typeof ExploreRoute
  '/walks': typeof WalksRoute
  '/stories': typeof StoriesRoute
  '/today': typeof TodayRoute
  '/ar': typeof ArRoute
  '/about': typeof AboutRoute
  '/admin/': typeof AdminIndexRoute
  '/admin/businesses': typeof AdminBusinessesRoute
  '/pages/$slug': typeof PagesSlugRoute
  '/pages/': typeof PagesIndexRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/explore': typeof ExploreRoute
  '/walks': typeof WalksRoute
  '/stories': typeof StoriesRoute
  '/today': typeof TodayRoute
  '/ar': typeof ArRoute
  '/about': typeof AboutRoute
  '/admin': typeof AdminIndexRoute
  '/admin/businesses': typeof AdminBusinessesRoute
  '/pages/$slug': typeof PagesSlugRoute
  '/pages': typeof PagesIndexRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/explore': typeof ExploreRoute
  '/walks': typeof WalksRoute
  '/stories': typeof StoriesRoute
  '/today': typeof TodayRoute
  '/ar': typeof ArRoute
  '/about': typeof AboutRoute
  '/admin/': typeof AdminIndexRoute
  '/admin/businesses': typeof AdminBusinessesRoute
  '/pages/$slug': typeof PagesSlugRoute
  '/pages/': typeof PagesIndexRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/explore' | '/walks' | '/stories' | '/today' | '/ar' | '/about' | '/admin/' | '/admin/businesses' | '/pages/$slug' | '/pages/'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/explore' | '/walks' | '/stories' | '/today' | '/ar' | '/about' | '/admin' | '/admin/businesses' | '/pages/$slug' | '/pages'
  id: '__root__' | '/' | '/explore' | '/walks' | '/stories' | '/today' | '/ar' | '/about' | '/admin/' | '/admin/businesses' | '/pages/$slug' | '/pages/'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ExploreRoute: typeof ExploreRoute
  WalksRoute: typeof WalksRoute
  StoriesRoute: typeof StoriesRoute
  TodayRoute: typeof TodayRoute
  ArRoute: typeof ArRoute
  AboutRoute: typeof AboutRoute
  AdminIndexRoute: typeof AdminIndexRoute
  AdminBusinessesRoute: typeof AdminBusinessesRoute
  PagesSlugRoute: typeof PagesSlugRoute
  PagesIndexRoute: typeof PagesIndexRoute
}
declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/explore': { id: '/explore'; path: '/explore'; fullPath: '/explore'; preLoaderRoute: typeof ExploreRouteImport; parentRoute: typeof rootRouteImport }
    '/walks': { id: '/walks'; path: '/walks'; fullPath: '/walks'; preLoaderRoute: typeof WalksRouteImport; parentRoute: typeof rootRouteImport }
    '/stories': { id: '/stories'; path: '/stories'; fullPath: '/stories'; preLoaderRoute: typeof StoriesRouteImport; parentRoute: typeof rootRouteImport }
    '/today': { id: '/today'; path: '/today'; fullPath: '/today'; preLoaderRoute: typeof TodayRouteImport; parentRoute: typeof rootRouteImport }
    '/ar': { id: '/ar'; path: '/ar'; fullPath: '/ar'; preLoaderRoute: typeof ArRouteImport; parentRoute: typeof rootRouteImport }
    '/about': { id: '/about'; path: '/about'; fullPath: '/about'; preLoaderRoute: typeof AboutRouteImport; parentRoute: typeof rootRouteImport }
    '/admin/': { id: '/admin/'; path: '/admin'; fullPath: '/admin/'; preLoaderRoute: typeof AdminIndexRouteImport; parentRoute: typeof rootRouteImport }
    '/admin/businesses': { id: '/admin/businesses'; path: '/admin/businesses'; fullPath: '/admin/businesses'; preLoaderRoute: typeof AdminBusinessesRouteImport; parentRoute: typeof rootRouteImport }
    '/pages/': { id: '/pages/'; path: '/pages'; fullPath: '/pages/'; preLoaderRoute: typeof PagesIndexRouteImport; parentRoute: typeof rootRouteImport }
    '/pages/$slug': { id: '/pages/$slug'; path: '/pages/$slug'; fullPath: '/pages/$slug'; preLoaderRoute: typeof PagesSlugRouteImport; parentRoute: typeof rootRouteImport }
  }
}
const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  ExploreRoute,
  WalksRoute,
  StoriesRoute,
  TodayRoute,
  ArRoute,
  AboutRoute,
  AdminIndexRoute,
  AdminBusinessesRoute,
  PagesSlugRoute,
  PagesIndexRoute,
}
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
