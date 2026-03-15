import type { BunPressOptions } from '@stacksjs/bunpress'

const config: BunPressOptions = {
  name: 'ts-printers',
  description: 'A TypeScript library and CLI for interacting with printers via IPP. Driver-based architecture with HP support built-in.',
  url: 'https://ts-printers.stacksjs.com',

  theme: {
    primaryColor: '#3b82f6',
  },

  nav: [
    { text: 'Guide', link: '/intro' },
    { text: 'Drivers', link: '/drivers/overview' },
    { text: 'API', link: '/api/printer' },
    {
      text: 'Stacks',
      items: [
        { text: 'Stacks Framework', link: 'https://stacksjs.com' },
        { text: 'BunPress', link: 'https://bunpress.sh' },
        { text: 'dtsx', link: 'https://dtsx.stacksjs.com' },
      ],
    },
    { text: 'GitHub', link: 'https://github.com/stacksjs/ts-printers' },
  ],

  sidebar: [
    {
      text: 'Get Started',
      items: [
        { text: 'What is ts-printers?', link: '/intro' },
        { text: 'Installation', link: '/install' },
        { text: 'Usage', link: '/usage' },
        { text: 'Configuration', link: '/config' },
      ],
    },
    {
      text: 'Drivers',
      items: [
        { text: 'Overview', link: '/drivers/overview' },
        { text: 'HP Driver', link: '/drivers/hp' },
        { text: 'Generic IPP', link: '/drivers/generic' },
        { text: 'Custom Drivers', link: '/drivers/custom' },
      ],
    },
    {
      text: 'Features',
      items: [
        { text: 'Discovery', link: '/api/discovery' },
        { text: 'Printing', link: '/api/printer' },
        { text: 'Firmware Updates', link: '/api/firmware' },
        { text: 'Maintenance', link: '/api/maintenance' },
        { text: 'IPP Protocol', link: '/api/ipp' },
      ],
    },
    {
      text: 'CLI',
      items: [
        { text: 'Commands', link: '/api/cli' },
      ],
    },
    {
      text: 'Community',
      items: [
        { text: 'Team', link: '/team' },
        { text: 'Sponsors', link: '/sponsors' },
        { text: 'Partners', link: '/partners' },
        { text: 'Postcardware', link: '/postcardware' },
        { text: 'License', link: '/license' },
      ],
    },
  ],

  socialLinks: [
    { icon: 'github', url: 'https://github.com/stacksjs/ts-printers' },
  ],

  sitemap: {
    enabled: true,
    baseUrl: 'https://ts-printers.stacksjs.com',
  },

  robots: {
    enabled: true,
  },
}

export default config
