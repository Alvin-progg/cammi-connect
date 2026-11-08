CamiConnect - Concept F (C Wreath) logo pack
============================================
Colors: Blue #1A62F2 · Navy #0F2342 · Sky #5CC8FF · Laurel green #2E8B57 · Mint (on dark) #6FD39A

svg/       Master vectors (scale to any size)
  mark-color      main logo, light backgrounds
  mark-reversed   on navy/dark backgrounds
  mark-navy       one-color (print, stamps, fax)
  mark-white      one-color on blue/photos
  mark-black      pure black for forms/photocopy
  *-small         simplified version for 32-48px (fewer, bigger leaves)
  *-tiny          for 16-24px (wreath becomes a solid "C")
  appicon-*       rounded-square app / PWA icons
  lockup-*        logo + "CamiConnect" wordmark (text uses the Geist font;
                  the PNG lockups have it rendered already)

png/mark/       every color version at 16, 24, 32, 48, 64, 128, 256, 512, 1024 px (transparent)
png/app-icon/   48-1024 px app icons (white and blue)
png/lockup/     horizontal and stacked lockups at 1x/2x/4x

favicon/        drop into Next.js:  favicon.ico -> src/app/favicon.ico
                icon.svg -> src/app/icon.svg ; apple-touch-icon.png -> src/app/apple-icon.png
                icon-192.png / icon-512.png for a web manifest

Rules: leave clear space of at least the cross-arm width around the mark.
Below 48px use the -small file; below 32px use -tiny (the favicon already does).
