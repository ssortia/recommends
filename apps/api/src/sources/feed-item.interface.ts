// Общий контракт Gate → ArticlesRepository (ADR-009): и RssGate, и TelegramGate
// возвращают элементы фида в этом формате, независимо от источника.
export interface FeedItem {
  guid?: string;
  link?: string;
  title?: string;
  isoDate?: string;
  pubDate?: string;
}
