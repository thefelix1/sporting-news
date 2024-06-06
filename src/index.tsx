import {
  Action,
  ActionPanel,
  Cache,
  Grid,
  ToastStyle,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  useNavigation,
} from "@raycast/api";
import axios from "axios";
import cheerio, { CheerioAPI } from "cheerio";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { NewsItem, Identifier } from "./types/NewsItem";
import JsGoogleTranslateFree, { LanguagesCodigoISO639WhitoutAuto } from "@kreisler/js-google-translate-free";
import ShowNewsDetails from "./components/newsDetails";

const cache = new Cache();

interface Club {
  name: string;
  url: string;
  img: string;
  source: string;
}

interface SearchProps {
  searchTextProp: string;
}

const prefs = getPreferenceValues();
export let dataSourceURL = prefs.dataSources === "abola" ? "https://www.abola.pt" : "https://maisfutebol.iol.pt";

export default function GetFootballNews({ searchTextProp }: SearchProps) {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [search, setSearch] = useState<string>(searchTextProp);
  const [data, setData] = useState<NewsItem[]>([
    {
      image: undefined,
      title: undefined,
      topic: undefined,
      time: undefined,
      url: undefined,
      header: undefined,
      headerTime: undefined,
      headerDay: undefined,
      newsText: undefined,
    },
  ]);

  function getFullUrl(clubUrl: string) {
    const url = dataSourceURL + clubUrl;
    return url;
  }

  useEffect(() => {
    setLoading(true);
    fetchClubs(dataSourceURL).then((clubs) => {
      setClubs(clubs);
      if (clubs.length > 0) {
        setSelectedClub(clubs[0]);
        fetchNewsData(getFullUrl(clubs[0].url), clubs[0].source, setLoading, setData);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedClub) {
      fetchNewsData(getFullUrl(selectedClub.url), selectedClub.source, setLoading, setData);
    }
  }, [selectedClub]);

  const handleChangeDataSource = () => {
    const newDataSource = prefs.dataSources === "abola" ? "maisfutebol" : "abola";
    prefs.dataSources = newDataSource;
    dataSourceURL = newDataSource === "abola" ? "https://www.abola.pt" : "https://maisfutebol.iol.pt";
    showToast(ToastStyle.Success, "Data Source Changed", `New Data Source: ${newDataSource}`);
    setLoading(true);
    fetchClubs(dataSourceURL).then((clubs) => {
      setClubs(clubs);
      if (clubs.length > 0) {
        setSelectedClub(clubs[0]);
        fetchNewsData(getFullUrl(clubs[0].url), clubs[0].source, setLoading, setData);
      }
    });
  };

  return loading ? (
    <Grid isLoading key={"grid1"} searchBarAccessory={<Grid.Dropdown tooltip="Loading News"></Grid.Dropdown>}>
      <Grid.EmptyView />
    </Grid>
  ) : data[data.length - 1].title && clubs[clubs.length - 1].name ? (
    <Grid
      key={"GRID2"}
      aspectRatio="16/9"
      fit={Grid.Fit.Fill}
      throttle
      columns={4}
      selectedItemId="0"
      searchBarPlaceholder="Search News"
      searchText={search}
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Select Club"
          value={selectedClub?.name}
          onChange={(newValue) => {
            const club = clubs.find((club) => club.name === newValue);
            if (club) {
              setSelectedClub(club);
            }
          }}
        >
          {clubs.map((club) => (
            <Grid.Dropdown.Item key={club.url} icon={club.img} value={club.name} title={club.name} />
          ))}
        </Grid.Dropdown>
      }
    >
      <Grid.Section title={`${prefs.dataSources} News`}>
        {data.map((newsItem, _index) =>
          newsItem.title != undefined && newsItem.image ? (
            <Grid.Item
              id={String(_index)}
              key={_index}
              subtitle={newsItem.topic!}
              title={newsItem.title!}
              content={newsItem.image}
              actions={
                <ActionPanel title="More">
                  <Action.Push title="Show Details" target={<ShowNewsDetails newsItem={newsItem} />} />
                  <Action title="Change Data Source" onAction={handleChangeDataSource} />
                </ActionPanel>
              }
            />
          ) : (
            ""
          ),
        )}
      </Grid.Section>
    </Grid>
  ) : (
    <Grid isLoading>
      <Grid.EmptyView />
    </Grid>
  );
}

async function fetchClubs(dataSources: string): Promise<Club[]> {
  const clubs: Club[] = [];
  const response = await axios.get(dataSourceURL);
  const $ = cheerio.load(response.data);
  if (dataSources.includes("abola")) {
    parseAbolaClubs($, clubs);
  } else if (dataSources.includes("maisfutebol")) {
    parseMaisfutebolClubs($, clubs);
  }
  return clubs;
}

function parseAbolaClubs($: CheerioAPI, clubs: Club[]) {
  $(".lista-clubes .caixa.clube a").each((_index, element) => {
    const name = $(element).find("img").attr("title")?.split(" - ")[0] || "Unknown";
    const url = $(element).attr("href") || "#";
    const img = $(element).find("img").attr("src") || "";
    clubs.push({ name, url, img, source: "abola" });
  });
}

function parseMaisfutebolClubs($: CheerioAPI, clubs: Club[]) {
  $(".barraCludes ul li a").each((_index, element) => {
    const name = $(element).find("img").attr("alt") || "Unknown";
    const url = $(element).attr("href") || "#";
    let img = $(element).find("img").attr("src") || "";
    if (!img.includes("https")) img = "https://maisfutebol.iol.pt" + img;
    clubs.push({ name, url, img, source: "maisfutebol" });
  });
}

async function fetchNewsData(
  clubUrl: string,
  source: string,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setData: Dispatch<SetStateAction<NewsItem[]>>,
): Promise<void> {
  setLoading(true);
  const cached = cache.get(`${clubUrl}_news`);
  const items: NewsItem[] = cached ? JSON.parse(cached) : [];

  try {
    const { data } = await axios.get(clubUrl);
    const $ = cheerio.load(data);
    const newsItems = source === "abola" ? parseAbolaNews($) : parseMaisfutebolNews($);

    const translatedNewsItems = prefs.language !== "pt" ? await translateNewsItems(newsItems) : newsItems;

    setData(translatedNewsItems);
    cache.set(`${clubUrl}_news`, JSON.stringify(newsItems));
  } catch (error) {
    console.error(`Error fetching news data from ${source}:`, error);
  } finally {
    setLoading(false);
  }
}

function parseAbolaNews($: CheerioAPI): NewsItem[] {
  const newsItems: NewsItem[] = [];
  $(".news-item").each((_index, element) => {
    let newsItem: NewsItem = {
      image: undefined,
      title: undefined,
      topic: undefined,
      time: undefined,
      url: undefined,
      header: undefined,
      headerTime: undefined,
      headerDay: undefined,
      newsText: undefined,
    };

    const imgTag = $(element).find(".news-item-image .noticia-inline picture noscript").text();
    const regex = /<img[^>]+src="([^"]+)"/;
    const imgSrc = regex.exec(imgTag);
    if (imgSrc) newsItem.image = imgSrc[1];

    newsItem.title = $(element).find(".titulo").text() || undefined;
    newsItem.topic = $(element).find(".tema").text() || undefined;
    newsItem.time = $(element).find(".data-hora").text() || undefined;
    newsItem.url = $(element).find(".news-item-image").attr("href")
      ? `https://www.abola.pt${$(element).find(".news-item-image").attr("href")}`
      : undefined;

    newsItems.push(newsItem);
  });
  return newsItems;
}

function parseMaisfutebolNews($: CheerioAPI): NewsItem[] {
  const newsItems: NewsItem[] = [];
  $(".fistTitle, .bigNewsList li").each((_index, element) => {
    let newsItem: NewsItem = {
      image: undefined,
      title: undefined,
      topic: undefined,
      time: undefined,
      url: undefined,
      header: undefined,
      headerTime: undefined,
      headerDay: undefined,
      newsText: undefined,
    };

    const imgElement = $(element).find("div.picture16x9, img");
    newsItem.image =
      imgElement.data("src") && !String(imgElement.data("src")).includes("https")
        ? "https://maisfutebol.iol.pt" + String(imgElement.data("src"))
        : String(imgElement.data("src"));

    newsItem.title = $(element).find("h1, h2").text() || undefined;
    newsItem.topic = $(element).find("span.seccaoName").text() || undefined;
    newsItem.time = $(element).find("em").text() || undefined;
    newsItem.url = $(element).find("a").last().attr("href")
      ? `https://maisfutebol.iol.pt${$(element).find("a").last().attr("href")}`
      : undefined;

    newsItems.push(newsItem);
  });
  return newsItems;
}

async function translateNewsItems(newsItems: NewsItem[]): Promise<NewsItem[]> {
  return await Promise.all(
    newsItems.map(async (item) => {
      if (item.title) {
        try {
          const titleTranslation = await JsGoogleTranslateFree.translate({
            from: "pt",
            to: prefs.language,
            text: item.title,
          });
          item.title = titleTranslation;
        } catch (error) {
          console.error("Error translating title:", error);
        }
      }
      if (item.topic) {
        try {
          const topicTranslation = await JsGoogleTranslateFree.translate({
            from: "pt",
            to: prefs.language,
            text: item.topic,
          });
          item.topic = topicTranslation;
        } catch (error) {
          console.error("Error translating topic:", error);
        }
      }
      return item;
    }),
  );
}
