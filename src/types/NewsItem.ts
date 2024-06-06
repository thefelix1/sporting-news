export interface NewsItem {
  image: string | undefined;
  title: string | undefined;
  topic: string | undefined;
  time: string | undefined;
  url: string | undefined;
  header: string | undefined;
  headerTime: string | undefined;
  headerDay: string | undefined;
  newsText: string | undefined;
}
export interface Identifier {
  categoryTitle: string | undefined;
  img: string | undefined;
}

export interface Tags {
  name: string;
  url: string;
}
