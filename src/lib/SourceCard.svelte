<script lang="ts">
  import { ArrowUpRight, FileText } from '@lucide/svelte';
  import type { SourceRef } from '../model/detail';

  let { source }: { source: SourceRef } = $props();
</script>

<svelte:element
  this={source.url ? 'a' : 'article'}
  class="sourcecard"
  class:is-link={Boolean(source.url)}
  href={source.url ?? undefined}
  target={source.url ? '_blank' : undefined}
  rel={source.url ? 'noopener noreferrer' : undefined}
  aria-label={source.url ? `Открыть источник: ${source.title}` : undefined}
>
  <span class="sourceicon" aria-hidden="true"><FileText size={16} strokeWidth={2} /></span>
  <span class="sourcebody">
    <span class="sourcetitle">{source.title}</span>
    {#if source.description}<span class="sourcedescription">{source.description}</span>{/if}
    {#if source.repository}<span class="repository">{source.repository}</span>{/if}
  </span>
  {#if source.url}
    <span class="openicon" aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span>
  {/if}
</svelte:element>

<style>
  .sourcecard {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: start;
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    margin-bottom: 8px;
    padding: 13px 13px 13px 14px;
    border: 0;
    border-radius: 14px;
    background: #fffbf5;
    box-shadow:
      0 0 0 1px rgba(70, 55, 40, 0.08),
      0 1px 2px -1px rgba(70, 55, 40, 0.08),
      0 3px 8px rgba(70, 55, 40, 0.035);
    color: #3f382f;
    font: inherit;
    text-align: left;
    text-decoration: none;
  }

  .sourcecard.is-link {
    cursor: pointer;
    transition-property: transform, background-color, box-shadow;
    transition-duration: 160ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }

  .sourcecard.is-link:hover {
    transform: translateY(-2px);
    background: #fffdf9;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent) 34%, transparent),
      0 4px 7px -3px rgba(70, 55, 40, 0.13),
      0 12px 24px rgba(70, 55, 40, 0.08);
  }

  .sourcecard.is-link:active { transform: translateY(0); }
  .sourcecard.is-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  .sourceicon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 20px;
    color: var(--accent);
  }

  .sourcebody { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .sourcetitle {
    color: #3f382f;
    font-size: 12.75px;
    font-weight: 750;
    line-height: 1.35;
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }
  .is-link:hover .sourcetitle { color: var(--accent); }
  .sourcedescription {
    color: #6a6358;
    font-size: 11.5px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }
  .repository {
    align-self: flex-start;
    margin-top: 2px;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--soft);
    color: var(--accent);
    font-size: 9.5px;
    font-weight: 700;
    line-height: 1.35;
  }
  .openicon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--accent);
    opacity: 0.42;
    transition-property: transform, opacity;
    transition-duration: 160ms;
    transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  .is-link:hover .openicon { transform: translate(2px, -2px); opacity: 1; }

  @media (prefers-reduced-motion: reduce) {
    .sourcecard.is-link, .openicon { transition-duration: 0ms; }
    .sourcecard.is-link:hover, .is-link:hover .openicon { transform: none; }
  }
</style>
