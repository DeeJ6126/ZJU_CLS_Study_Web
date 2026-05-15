(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))t(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const l of n.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&t(l)}).observe(document,{childList:!0,subtree:!0});function i(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function t(a){if(a.ep)return;a.ep=!0;const n=i(a);fetch(a.href,n)}})();const c=[{id:"resources",label:"资源中心",kicker:"Resource",description:"课程资料、工具入口与学习清单",href:"#resources"},{id:"academic-guidance",label:"学业领航",kicker:"Navigator",description:"培养方案、选课路径与升学经验",href:"#academic-guidance"},{id:"peer-support",label:"朋辈辅学",kicker:"Peer",description:"答疑预约、学习小组与经验分享",href:"#peer-support"},{id:"lab-open-day",label:"实验室开放日",kicker:"Lab",description:"实验室开放、导师方向与报名入口",href:"#lab-open-day"},{id:"beautiful-activities",label:"最美活动",kicker:"Showcase",description:"学习生活作品展示与活动征集",href:"#beautiful-activities",children:[{id:"beautiful-notes",label:"最美笔记",href:"#beautiful-notes"},{id:"beautiful-schedule",label:"最美日程表",href:"#beautiful-schedule"},{id:"beautiful-desk",label:"最美书桌",href:"#beautiful-desk"}]}];function r(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function o(e=[]){return e.length?`<ul class="nav-sublist" aria-label="最美活动子导航">${e.map(i=>`
        <li class="nav-sublist__item">
          <a class="nav-sublist__link" href="${r(i.href)}">
            <span class="nav-sublist__mark" aria-hidden="true"></span>
            <span>${r(i.label)}</span>
          </a>
        </li>
      `).join("")}</ul>`:""}function d(e,s){const i=s===0,t=!!e.children?.length;return`
    <li class="nav-list__item ${t?"nav-list__item--group":""}">
      <a
        class="nav-item ${i?"is-active":""}"
        href="${r(e.href)}"
        ${t?'aria-expanded="true"':""}
      >
        <span class="nav-item__symbol" aria-hidden="true">${String(s+1).padStart(2,"0")}</span>
        <span class="nav-item__copy">
          <span class="nav-item__label">${r(e.label)}</span>
          <span class="nav-item__meta">${r(e.kicker)}</span>
        </span>
      </a>
      ${o(e.children)}
    </li>
  `}function p(e){return`
    <aside class="app-sidebar" aria-label="学习平台主导航">
      <div class="brand-panel">
        <a class="brand" href="#top" aria-label="返回学习平台首页">
          <span class="brand__seal" aria-hidden="true">
            <span class="brand__helix"></span>
          </span>
          <span class="brand__copy">
            <span class="brand__eyebrow">生命科学学院</span>
            <span class="brand__name">生科智学</span>
          </span>
        </a>
        <p class="brand__note">面向生命科学学子的学习与成长平台</p>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list">${e.map(d).join("")}</ul>
      </nav>

      <div class="sidebar-footer" aria-label="平台维护信息">
        <span class="sidebar-footer__title">Academic Department</span>
        <span class="sidebar-footer__text">学习资源持续整理中</span>
      </div>
    </aside>
  `}function u(e){const s=e.children?.length?`<p class="section-card__meta">${e.children.map(i=>i.label).join(" / ")}</p>`:"";return`
    <section class="section-card" id="${e.id}">
      <span class="section-card__kicker">${e.kicker}</span>
      <h2>${e.label}</h2>
      <p>${e.description}</p>
      ${s}
    </section>
  `}function b(){const e=c.map(u).join("");document.querySelector("#app").innerHTML=`
    <div class="site-shell" id="top">
      ${p(c)}
      <main class="main-content">
        <header class="topbar">
          <button class="sidebar-toggle" type="button" aria-label="打开或收起侧边栏">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="topbar__identity">
            <span>生命科学学子学习平台</span>
            <strong>初版导航结构</strong>
          </div>
        </header>

        <div class="intro-panel">
          <p class="intro-panel__eyebrow">Life Science Learning Platform</p>
          <h1>把课程资源、朋辈支持和实验室机会放在同一个清晰入口。</h1>
          <p>
            当前版本先完成侧边栏与信息架构。右侧区域保留为后续资源卡片、活动投稿、
            实验室开放日和榜单展示的内容容器。
          </p>
        </div>

        <div class="section-grid" aria-label="栏目预览">
          ${e}
        </div>
      </main>
    </div>
  `}function f(){const e=document.querySelector(".site-shell"),s=document.querySelector(".sidebar-toggle"),i=document.querySelectorAll(".nav-item, .nav-sublist__link");s?.addEventListener("click",()=>{e.classList.toggle("is-sidebar-open")}),i.forEach(t=>{t.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(a=>a.classList.remove("is-active")),t.closest(".nav-list__item")?.querySelector(".nav-item")?.classList.add("is-active"),e.classList.remove("is-sidebar-open")})})}b();f();
