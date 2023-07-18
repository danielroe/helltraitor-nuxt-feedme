import { Feed, type FeedOptions } from 'feed'
import type { H3Event } from 'h3'
import { H3Error, defineEventHandler, setHeaders } from 'h3'

import type { FeedmeRSSOptions } from '../types'
import { getFeedmeModuleOptions, getFeedmeRSSTypeFrom, intoContentType, intoSeconds } from './feedme'

import { useNitroApp } from '#imports'

interface FeedmeHandleDefaultPersistent {
  feed?: Feed
}

const feedmeHandleDefault = async (event: H3Event, feedme: FeedmeRSSOptions) => {
  setHeaders(event, {
    'Content-Type': intoContentType(feedme?.type) ?? 'text/plain',
    'Cache-Control': `Max-Age=${intoSeconds(feedme?.revisit)}`,
  })

  const feedmeHandlePersistent: FeedmeHandleDefaultPersistent = {}
  const feedmeHandleOptions = {
    context: { event },
    feed: {
      create: (options: FeedOptions) => {
        feedmeHandlePersistent.feed = new Feed(options)
        return feedmeHandlePersistent.feed
      },
      invoke: () => feedmeHandlePersistent.feed,
      feedme,
    },
  }

  await useNitroApp().hooks.callHook(`feedme:handle[${event.path}]`, feedmeHandleOptions)
  await useNitroApp().hooks.callHook('feedme:handle', feedmeHandleOptions)

  const kind = feedme?.type ?? getFeedmeRSSTypeFrom(event.path)
  if (!kind)
    return new H3Error(`[nuxt-feedme]: Unable to determine RSS feed type from route '${event.path}'`)

  const feed = feedmeHandlePersistent.feed
  if (!feed)
    return new H3Error(`[nuxt-feedme]: The RSS feed wasn't created for route '${event.path}'`)

  if (typeof feed[kind] !== 'function')
    return new H3Error(`[nuxt-feedme]: Incorrect kind '${kind}' of RSS feed type from route '${event.path}'`)

  return feed[kind]()
}

export default defineEventHandler(async (event) => {
  const moduleOptions = getFeedmeModuleOptions()
  const feedme = moduleOptions.feeds[event.path]
  if (!feedme) {
    return new H3Error(
      `[nuxt-feedme]: Incorrect handler set for route '${event.path}'`
      + ` That route is not found in feeds: ${JSON.stringify(moduleOptions.feeds)}`)
  }

  return await feedmeHandleDefault(event, feedme)
})
