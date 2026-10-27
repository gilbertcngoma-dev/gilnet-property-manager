<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Restaurant service type is stored on each sale so room-service records remain identifiable.
- Stay extensions update the existing stay's checkout date and reuse shared charge calculations so totals remain consistent across pages.
- Windows desktop packaging uses the isolated Electron wrapper in electron/ to load the published app; package its files under resources/app and preserve all Electron runtime files, so the website and desktop share records without changing the web build.
- Capture browser install events in the root InstallAppProvider and present installation through the staff layout; retain manifest-only support without a service worker because home-screen installation does not require offline caching.
