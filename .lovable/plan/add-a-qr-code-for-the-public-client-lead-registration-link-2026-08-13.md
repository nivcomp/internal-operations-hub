Add a QR code for the public client/lead registration link

Goal
------
Display a scannable QR code next to the existing public client registration link so leads can open it on a phone without typing the URL.

What will change
----------------
1. Add a QR-code generation dependency (`qrcode` + `@types/qrcode`).
2. Create a small reusable component `src/components/ui/QrCode.tsx` that renders a QR code for a given URL as a data-URI image or inline SVG.
3. Integrate the component into `src/components/access/PublicLinkSettings.tsx` (advanced view shown in the screenshot) so the QR appears only when the client link is enabled, alongside the existing Copy/Replace/Daily limit actions.
4. Optionally integrate the same component into `src/components/simple/ShareLinksCard.tsx` (simple Hebrew view) for consistency.
5. Run `pnpm run build` to verify TypeScript and bundle output.

Out of scope
------------
- No changes to the link generation, rotation, daily limit, or registration logic.
- No backend changes.
- No redesign of the surrounding UI beyond placing the QR code in the existing card.

Acceptance criteria
-------------------
- [ ] A QR code is visible for the enabled client registration link in the advanced settings view.
- [ ] Scanning the QR code opens the exact same URL shown in the input field.
- [ ] The QR code updates automatically when the link is rotated.
- [ ] `pnpm run build` passes without errors.
