const articlesContainer = document.getElementById("articles");
const featuredArticle = document.getElementById("featuredArticle");
const breakingNews = document.getElementById("breakingNews");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

const menuButton = document.getElementById("menuButton");
const mainNav = document.getElementById("mainNav");

let allArticles = [];


/* MOBILE MENU */

if (menuButton && mainNav) {
  menuButton.addEventListener("click", () => {
    mainNav.classList.toggle("show");
  });
}


/* LIVE RWANDA TIME */

function updateClock() {
  const clock = document.getElementById("liveClock");

  if (!clock) return;

  const now = new Date();

  clock.textContent = now.toLocaleTimeString(
    "en-RW",
    {
      timeZone: "Africa/Kigali",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );
}

updateClock();

setInterval(updateClock, 1000);
function formatDateTime(dateValue) {
  if (!dateValue) return "";

  return new Date(dateValue).toLocaleString(
    "en-RW",
    {
      timeZone: "Africa/Kigali",
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}


/* LOAD ARTICLES */

async function loadArticles() {
  try {
    const response = await fetch("/api/articles");

    if (!response.ok) {
      throw new Error("Failed to load articles");
    }

    allArticles = await response.json();

    showBreakingNews(allArticles);
    showFeaturedArticle(allArticles);
    displayArticles(allArticles);

    filterFromUrl();

  } catch (error) {
    console.error(error);

    if (featuredArticle) {
      featuredArticle.innerHTML =
        "<p class='loading'>Unable to load featured news.</p>";
    }

    if (articlesContainer) {
      articlesContainer.innerHTML =
        "<p class='loading'>Unable to load news right now.</p>";
    }
  }
}


/* BREAKING NEWS */

function showBreakingNews(articles) {
  if (!breakingNews) return;

  if (articles.length === 0) {
    breakingNews.textContent =
      "No breaking news available.";
    return;
  }

  breakingNews.textContent =
    articles[0].title;
}/* FEATURED ARTICLE */

function showFeaturedArticle(articles) {
  if (!featuredArticle) return;

  if (articles.length === 0) {
    featuredArticle.innerHTML =
      "<p class='loading'>No featured news available.</p>";
    return;
  }

  const article = articles[0];

  const image = article.image
    ? article.image
    : "https://via.placeholder.com/1200x600?text=UMUCYO+NEWS";

  const date = formatDateTime(article.created_at);

  featuredArticle.innerHTML = `
    <img
      src="${image}"
      alt="${escapeHtml(article.title)}"
      onerror="this.src='https://via.placeholder.com/1200x600?text=UMUCYO+NEWS'"
    >

    <div class="featured-content">

      <div class="featured-meta">
        ${escapeHtml(article.category)}
        •
        ${escapeHtml(article.author)}
        •
        ${date}
      </div>

      <h1>
        ${escapeHtml(article.title)}
      </h1>

      <p>
        ${escapeHtml(
          (article.content || "").substring(0, 180)
        )}
        ...
      </p>

      <a
        class="read-more"
        href="/article.html?id=${article.id}"
      >
        Read Full Story →
      </a>

    </div>
  `;
}


/* DISPLAY NEWS */

function displayArticles(articles) {
  if (!articlesContainer) return;

  if (articles.length === 0) {
    articlesContainer.innerHTML =
      "<p class='loading'>No news articles found.</p>";
    return;
  }

  articlesContainer.innerHTML = articles.map(article => {

    const image = article.image
      ? article.image
      : "https://via.placeholder.com/600x350?text=UMUCYO+NEWS";

    const date = formatDateTime(article.created_at);

    const preview =
      (article.content || "").substring(0, 130);

    return `
      <article class="news-card">

        <a href="/article.html?id=${article.id}">

          <img
            src="${image}"
            alt="${escapeHtml(article.title)}"
            onerror="this.src='https://via.placeholder.com/600x350?text=UMUCYO+NEWS'"
          >

        </a>

        <div class="news-card-content">

          <div class="news-category">
            ${escapeHtml(article.category)}
          </div>

          <h3>
            ${escapeHtml(article.title)}
          </h3>

          <p>
            ${escapeHtml(preview)}...
          </p>

          <div class="news-meta">
            By ${escapeHtml(article.author)}
            •
            ${date}
          </div>

          <a
            class="read-more"
            href="/article.html?id=${article.id}"
          >
            Read More →
          </a>

        </div>

      </article>
    `;

  }).join("");
}/* SEARCH */

function searchNews() {
  if (!searchInput) return;

  const searchText =
    searchInput.value.toLowerCase().trim();

  if (!searchText) {
    displayArticles(allArticles);
    return;
  }

  const filtered = allArticles.filter(article => {
    return (
      (article.title || "").toLowerCase().includes(searchText) ||
      (article.content || "").toLowerCase().includes(searchText) ||
      (article.category || "").toLowerCase().includes(searchText) ||
      (article.author || "").toLowerCase().includes(searchText)
    );
  });

  displayArticles(filtered);
}

if (searchInput) {
  searchInput.addEventListener("input", searchNews);
}

if (searchButton) {
  searchButton.addEventListener("click", searchNews);
}


/* CATEGORY FROM URL */

function filterFromUrl() {
  const params =
    new URLSearchParams(window.location.search);

  const category =
    params.get("category");

  if (!category) return;

  const filtered =
    allArticles.filter(article =>
      (article.category || "").toLowerCase() ===
      category.toLowerCase()
    );

  displayArticles(filtered);
}


/* ESCAPE HTML */

function escapeHtml(text) {
  const div =
    document.createElement("div");

  div.textContent =
    text || "";

  return div.innerHTML;
}


/* START */

loadArticles();
