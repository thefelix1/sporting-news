import { Action, ActionPanel, Detail, getPreferenceValues, open, useNavigation } from "@raycast/api";
import axios from "axios";
import cheerio, { CheerioAPI, Element } from "cheerio";
import { useEffect, useState } from "react";
import { NewsItem, Tags } from "../types/NewsItem";
import html2md from "html-to-md";
import GetFootballNews, { dataSourceURL } from "..";

interface NewsDetailProps {
  newsItem: NewsItem;
}

export default function NewsDetail({ newsItem }: NewsDetailProps) {
  const [newsItemSingle, setNewsItemSingle] = useState<NewsItem>(newsItem); // TODO: remove this line and use the one below
  const [loading, setLoading] = useState(true);
  const [newsTags, setNewsTags] = useState<Tags[]>([]);
  const { pop, push } = useNavigation();
  const prefs = getPreferenceValues();

  useEffect(() => {
    async function fetchNewsDetail() {
      try {
        const { data } = await axios.get(newsItem.url!);
        const $ = cheerio.load(data);

        let articleContent: NewsItem = newsItemSingle;
        let articleTags: Tags[] = [];
        if (prefs.dataSources.includes("abola")) {
          articleContent = parseAbolaArticle($, newsItem);
          articleTags = parseAbolaTags($);
        } else if (prefs.dataSources.includes("maisfutebol")) {
          articleContent = parseMaisfutebolArticle($, newsItem);
        }

        setNewsItemSingle(articleContent);
        setNewsTags(articleTags);
      } catch (error) {
        console.error("Error fetching news detail:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNewsDetail();
  }, [newsItem.url]);

  return (
    <Detail
      isLoading={loading}
      markdown={newsItemSingle.newsText}
      actions={
        <ActionPanel>
          <Action title="Back" onAction={pop} />
        </ActionPanel>
      }
      metadata={
        loading ? null : (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Data" text={`${newsItemSingle.headerDay} ${newsItemSingle.headerTime}`} />
            <Detail.Metadata.TagList title="Tags">
              {newsTags.map((tag) => (
                <Detail.Metadata.TagList.Item
                  onAction={() => {
                    push(<GetFootballNews searchTextProp={tag.name} />); // Use the URL from the tag
                  }}
                  text={tag.name}
                  key={tag.name}
                />
              ))}
            </Detail.Metadata.TagList>
          </Detail.Metadata>
        )
      }
    />
  );
}

function parseAbolaArticle($: CheerioAPI, newsItem: NewsItem): NewsItem {
  const convertToMd = (html: string) => html2md(html, { skipTags: ["picture"], renderCustomTags: "SKIP" });

  const newsItemComplete: NewsItem = {
    title: convertToMd($(".titulo").html() || ""),
    header: convertToMd($(".single-news-header").html() || ""),
    headerTime: convertToMd($(".data-hora").html() || ""),
    headerDay: convertToMd($(".data-vermelho").html() || ""),
    newsText: convertToMd($(".single-news-content").html() || ""),
    image: newsItem.image,
    url: newsItem.url,
    time: newsItem.time,
    topic: newsItem.topic,
  };

  return newsItemComplete;
}

function parseAbolaTags($: CheerioAPI): Tags[] {
  let tags = $(".news-tags").html() || "";
  tags = html2md(tags, { skipTags: ["picture"], renderCustomTags: "SKIP" });
  const tagsSplit = tags.split("[");
  let tagsObjArray: Tags[] = [];
  for (let i = 1; i < tagsSplit.length; i++) {
    tagsObjArray.push({
      name: tagsSplit[i].split("]")[0],
      url: tagsSplit[i].split("]")[1].replace("(", "").replace(")", ""),
    });
  }
  return tagsObjArray;
}

function parseMaisfutebolArticle($: CheerioAPI, newsItem: NewsItem): NewsItem {
  const content = $(".articleBody").html() || "";
  return newsItem;
}

function convertToMarkdown(html: string): string {
  const $ = cheerio.load(html);
  let markdown = "";

  function traverse(node: Element) {
    const tagName = node.tagName;
    const tagContent = $(node).html();
    if (tagContent === null) return;
    else {
      if (tagName === "p") {
      } else if (tagName === "a") {
        const href = $(node).attr("href");
        const text = $(node).text();
        markdown += `[${text}](${href})`;
      } else if (tagName === "img") {
        const alt = $(node).attr("alt");
        const src = $(node).attr("src");
        markdown += `![${alt}](${src})`;
      } else {
        markdown += convertInnerHtmlToMarkdown($, tagContent);
      }
    }
  }

  $("body")
    .children()
    .each((_, child) => traverse(child));

  return markdown.trim();
}

function convertInnerHtmlToMarkdown($: CheerioAPI, html: string): string {
  const $inner = cheerio.load(html);
  const parts: string[] = [];

  $inner("*").each((_, innerChild) => {
    if (innerChild.type === "text") {
      parts.push($(innerChild).text());
    } else if (innerChild.type === "tag") {
      if (innerChild.tagName === "a") {
        const href = $(innerChild).attr("href");
        const text = $(innerChild).text();
        parts.push(`[${text}](${href})`);
      } else if (innerChild.tagName === "strong") {
        const strongText = $(innerChild).html() || "";
        parts.push(`**${convertInnerHtmlToMarkdown($, strongText)}**`);
      }
    }
  });

  return parts.join("");
}
