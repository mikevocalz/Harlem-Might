import type { ProseSection } from '@acme/ui/mights';

export const LEGAL_UPDATED = '3 October 2026';

export const DRAFT_NOTE =
  'This is a working draft written in plain language. It describes how the site works today and will be reviewed before it takes effect.';

export const PRIVACY: readonly ProseSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    body: [
      'You can use the Harlem Might website without an account, without signing in and without telling us who you are. The public site does not run analytics, does not show advertising, does not use tracking pixels and does not set cookies.',
      'The one outside service involved in every visit is Mapbox, which draws the maps. The rest of this page explains that, and the few other cases where information leaves your browser.',
    ],
  },
  {
    id: 'collect',
    title: 'What we collect on the website',
    body: [
      'When you browse the public site, we do not ask for or store your name, email address, location or any other personal details. Searches and filters on the Explore map are kept in the page address in your own browser so you can share or bookmark them. They are not saved to an account.',
      'Like any website, the servers that deliver these pages receive standard technical information with each request, such as your IP address, browser type and the page requested. This is used to deliver the site, keep it secure and fix problems.',
    ],
  },
  {
    id: 'maps',
    title: 'Maps and Mapbox',
    body: [
      'Maps on Harlem Might are provided by Mapbox. To show a map, your browser requests map images and data directly from Mapbox, which means Mapbox receives technical details such as your IP address and browser information, and may record that a map was loaded. Mapbox handles that information under its own privacy policy.',
      'Map data comes from OpenStreetMap contributors. Showing a map does not share your precise location with us. Harlem Might never asks your browser for your location on the website.',
    ],
  },
  {
    id: 'links',
    title: 'Directions and other links',
    body: [
      'If you choose Get directions on a place, you are sent to Google Maps with that place’s address filled in. From that point Google’s own privacy policy applies. Other links to outside websites work the same way.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: [
      'The public pages of Harlem Might do not set cookies. The only cookies used on this domain belong to the private editing area used by the Harlem Might team to sign in and manage the catalogue. Visitors never see that area.',
    ],
  },
  {
    id: 'app',
    title: 'The Harlem Might app',
    body: [
      'The Harlem Might app for iPhone and Android is still in testing. Features such as walking directions and AR use your device’s location and camera, and the app will ask your permission before using either. The app will have its own section in this policy, describing exactly what it collects, before it is released.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    body: [
      'The website does not collect personal information from anyone, including children. It is suitable for students and classrooms to use without creating accounts.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: [
      'When this policy changes, the date at the top of the page changes with it. A contact address for privacy questions is being set up and will be listed here.',
    ],
  },
];

export const TERMS: readonly ProseSection[] = [
  {
    id: 'welcome',
    title: 'Using Harlem Might',
    body: [
      'Harlem Might is a free guide to the places, history and life of Harlem. By using the site you agree to use it lawfully and respectfully, toward the site and toward the neighborhood it describes.',
    ],
  },
  {
    id: 'accuracy',
    title: 'Information on the site',
    body: [
      'We research every place carefully and attach sources to the facts we publish, but places change. Hours shift, events are rescheduled and businesses close. Treat opening times and event details as a guide, and check with the place directly before you travel.',
      'Historical information reflects the sources available to us. When better evidence appears, we update the record. If you see something wrong, the About page explains how corrections work.',
    ],
  },
  {
    id: 'street',
    title: 'Out on the street',
    body: [
      'Walks and AR are meant to be used outside, so please look up from your screen often:',
      [
        'Stay aware of traffic, cyclists and other people on the sidewalk.',
        'Never enter private property. Many historic places in Harlem are homes, and some places on the map are best seen from a public viewpoint.',
        'Be respectful at places of worship, memorials and community spaces.',
        'Do not use AR while driving or cycling.',
      ],
    ],
  },
  {
    id: 'content',
    title: 'Our content and other people’s',
    body: [
      'The writing, design, logo and research on Harlem Might belong to Harlem Might unless a credit says otherwise. You are welcome to link to any page and to quote short passages with a credit and a link back.',
      'Photographs, archival images and data from other sources belong to their owners and are credited where they appear. Map data is © OpenStreetMap contributors and maps are provided by Mapbox, each under their own terms.',
    ],
  },
  {
    id: 'use',
    title: 'Fair use of the site',
    body: [
      'Please do not copy the catalogue in bulk, run automated scraping that strains the service, interfere with the site’s security, or use the site to harass anyone. We may limit access for anyone who does.',
    ],
  },
  {
    id: 'links',
    title: 'Links to other sites',
    body: [
      'Harlem Might links to outside services such as Google Maps and to the websites of places on the map. We are not responsible for the content or policies of those sites.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: [
      'These terms will change as Harlem Might grows, including when the app is released. The date at the top of the page shows the latest version. A contact address for questions about these terms is being set up and will be listed here.',
    ],
  },
];

export const ACCESSIBILITY: readonly ProseSection[] = [
  {
    id: 'commitment',
    title: 'Our commitment',
    body: [
      'Harlem Might should work for everyone who wants to know the neighborhood, including people who use screen readers, keyboards, magnification, captions or reduced motion. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across the website.',
    ],
  },
  {
    id: 'built-in',
    title: 'What is built in',
    body: [
      [
        'A skip link at the top of every page jumps straight to the main content.',
        'Every page can be used with a keyboard alone, and focused controls are marked with a visible gold frame.',
        'Every page has a single main heading that matches its name in the navigation, and the navigation is the same on every page.',
        'The Explore map has a full list alternative with search and filters, so every place can be found and opened without using the map.',
        'Search, filters and the selected place are kept in the page address, so the back button, reloading and sharing all work as expected.',
        'If your device is set to reduce motion, animations on the site are switched off or replaced with still images.',
        'Text and controls use high-contrast colors on a dark background, and text can be enlarged without losing content.',
        'Images have text descriptions for screen readers.',
      ],
    ],
  },
  {
    id: 'limits',
    title: 'Known limitations',
    body: [
      'We would rather tell you about a gap than hide it:',
      [
        'The interactive map itself is a visual canvas. Its markers can be reached by keyboard and are labelled, but the list next to it is the most reliable way to browse with a screen reader.',
        'The AR experience runs in the app and depends on a camera and the ability to hold up a phone. Everything shown in AR is also available as text on the place’s page.',
        'Some controls inside the map are provided by Mapbox and follow its own accessibility support.',
      ],
    ],
  },
  {
    id: 'places',
    title: 'Accessibility of places',
    body: [
      'Accessibility is also about getting through the door. Place records in Harlem Might are designed to hold accessible entrances and step-free routes where they exist. We only publish this information once it has been verified, because a wrong answer here is worse than no answer.',
    ],
  },
  {
    id: 'assessment',
    title: 'How we checked',
    body: [
      'This statement is based on our own testing during development, including keyboard-only use and checks of color contrast, headings and labels. The site has not yet had an independent accessibility audit. We plan to commission one, and will publish what it finds.',
    ],
  },
  {
    id: 'feedback',
    title: 'Tell us about a barrier',
    body: [
      'If any part of Harlem Might is hard to use, please tell us what you were trying to do and what got in the way. A contact address for accessibility feedback is being set up and will be listed here, and we will treat every report as a bug to fix.',
    ],
  },
];
