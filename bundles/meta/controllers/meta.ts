// Require dependencies
import uuid       from 'uuid/v4';
import config     from 'config';
import Controller from 'controller';
import { SitemapStream, streamToPromise } from 'sitemap';

/**
 * Build meta controller
 *
 * @priority 90
 */
export default class MetaController extends Controller {
  /**
   * Construct example controller class
   */
  constructor() {
    // Run super eden
    super();

    // set variables
    this.sitemap = null;

    // build methods
    this.build = this.build.bind(this);

    // bind actions
    this.sitemapAction = this.sitemapAction.bind(this);
    this.middlewareAction = this.middlewareAction.bind(this);

    // bind
    this.generateSitemap = this.generateSitemap.bind(this);

    // build
    this.building = this.build();
  }


  // /////////////////////////////////////////////////////////////////////////////////////////////
  //
  //  Build Methods
  //
  // /////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * build
   */
  build() {
    // Generate sitemap
    if (config.get('sitemap') && config.get('sitemap.enabled')) {
      // Generate on interval
      this.generateSitemap();

      // Set interval
      if (config.get('sitemap.interval')) setInterval(this.generateSitemap, config.get('sitemap.interval'));
    }

    // use middleware
    this.eden.router.use(this.middlewareAction);

    // On render
    this.eden.pre('view.compile', ({ head, res, render }) => {
      // set values
      const { meta } = res;

      // loop meta
      Object.keys(meta).sort().forEach((type) => {
        // Sort names
        let names = Object.keys(meta[type]);
  
        // Check if meta
        if (type === 'meta') {
          names = names.sort((a, b) => {
          // Return a/b
            a = (meta[type][a].property || meta[type][a].name || '').split(':')[0];
            b = (meta[type][b].property || meta[type][b].name || '').split(':')[0];
  
            // Return sorted
            return a > b ? -1 : a < b ? 1 : 0;
          });
        }
  
        // Loop for name
        names.forEach((name) => {
          // Let value
          const keys  = Object.keys(meta[type][name]).sort().reverse();
          const value = meta[type][name];
  
          // Add to head
          head += `<${type}`;
  
          // Loop for tags
          for (let i = 0; i < keys.length; i += 1) {
            // Check tag
            if (keys[i] === 'id') continue;
  
            // Add tag
            head += ` ${keys[i]}="${value[keys[i]]}"`;
          }
  
          // Close tag
          head += ' />';
        });
      });
    });
  }


  // /////////////////////////////////////////////////////////////////////////////////////////////
  //
  //  Action Methods
  //
  // /////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Build middleware
   *
   * @param  {request}  req Express request
   * @param  {response} res Express response
   * @param  {function} next Next callback
   *
   * @private
   */
  async middlewareAction(req, res, next) {
    // set meta
    res.meta = {};

    // Create meta function
    const metaMiddleware = (type, opts) => {
      // Check type and opts
      if (typeof type === 'object' || !opts) {
        // Set variables
        opts = type;
        type = 'meta';
      }

      // Get name
      const name = opts.id || uuid();

      // Check type
      if (type === 'title') return req.title(opts);
      if (type === 'image') return req.image(opts);
      if (type === 'description') return req.description(opts);

      // Check opts
      if (typeof opts === 'string') {
        opts = {
          name    : type,
          content : opts,
        };
        type = 'meta';
      }

      // Check meta type
      if (!res.meta[type]) res.meta[type] = {};

      // Set meta
      res.meta[type][name] = opts;

      // Return req
      return res;
    };

    // set to req/res
    req.meta = res.meta = metaMiddleware;

    // Create description
    const ogMiddleware = (name, content, id) => {
      // Add description
      req.meta({
        id,
        content,
        property : `og:${name}`,
      });

      // Return req
      return res;
    };

    // set to req/res
    req.og = res.og = ogMiddleware;

    // Create description
    const articleMiddleware = (name, content, id) => {
      // Add description
      req.meta({
        id,
        content,
        property : `article:${name}`,
      });

      // Return req
      return res;
    };

    // set to req/res
    req.article = res.article = articleMiddleware;

    // Create description
    const twitterMiddleware = (name, content, id) => {
      // Add description
      req.meta({
        id,
        name    : `twitter:${name}`,
        content,
      });

      // Return req
      return res;
    };

    // add to req/res
    req.twitter = res.twitter = twitterMiddleware;

    // Create description
    const titleMiddleware = (title) => {
      // Set title
      res.page = res.page || {};

      // Set title
      res.page.title = req.t(title);

      // Add description
      req.og('title', req.t(title), 'og:title');
      req.meta({
        id       : 'title',
        content  : req.t(title),
        itemprop : 'name',
      });
      req.twitter('title', req.t(title), 'twitter:title');

      // Return req
      return res;
    };

    // add to req/res
    req.title = res.title = titleMiddleware;

    // Create description
    const descriptionMiddleware = (description) => {
      // Trim description
      if (description.length > 160) {
        // Get descriotion
        const split = description.substring(0, 160).split(' ');

        // Slice
        description = split.splice(0, (split.length - 1)).join(' ');
      }

      // Add description
      req.og('description', description, 'og:description');
      req.meta({
        id       : 'description',
        name     : 'description',
        content  : description,
        itemprop : 'description',
      });
      req.twitter('description', description, 'twitter:description');

      // Return req
      return res;
    };

    // add to req/res
    req.description = res.description = descriptionMiddleware;

    // Create description
    const imageMiddleware = (url, width, height) => {
      // Add image
      req.og('image', url);

      // Set size
      if (width) req.og('image:width', width);
      if (height) req.og('image:height', height);

      // Set url
      req.og('image:url', url);
      req.og('image:secure_url', url);

      // Set itemprop
      req.meta({
        content  : url,
        itemprop : 'image',
      });

      // Set twitter
      req.twitter('image', url);

      // Return req
      return res;
    };

    // add to req/res
    req.image = res.image = imageMiddleware;

    // Set default title
    req.title(config.get('title'));

    // Set default
    req.og('url', `https://${config.get('domain')}${req.url}`, 'og:url');
    req.og('locale', req.language, 'og:locale');
    req.twitter('card', 'summary', 'twitter:summary');
    req.twitter('site', config.get('title'), 'twitter:site');

    // Run next
    next();
  }

  /**
   * Create sitemap
   *
   * @param  {Request}   req
   * @param  {Response}  res
   *
   * @route  {get} /sitemap.xml
   *
   * @return {Promise}
   */
  async sitemapAction(req, res, next) {
    // Check sitemap
    if (!this._sitemap) return next();

    // Return sitemap
    return this._sitemap.toXML((err, xml) => {
      // Check error
      if (err) return next();

      // Set header
      res.header('Content-Type', 'application/xml');

      // Send xml
      return res.send(xml);
    });
  }


  // /////////////////////////////////////////////////////////////////////////////////////////////
  //
  //  Generate Methods
  //
  // /////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Generates xml
   *
   * @return {Promise}
   */
  async generateSitemap() {
    // Create sitemap
    const map = {
      hostname  : `https://${config.get('domain')}`,
      cacheTime : config.get('sitemap.cache') || 600000,
      urls      : [
        {
          url        : '',
          priority   : 1,
          changefreq : 'daily',
        },
      ],
    };

    // set sitemap
    let sitemap = null;

    // Hook generate
    await this.eden.hook('sitemap', map, () => {
      // create stream
      sitemap = new SitemapStream(map);
    });
    
    // Create
    this.sitemap = await streamToPromise(sitemap);
    this.eden.sitemap = this.sitemap;

    // Trigger sitemap
    this.eden.emit('sitemap');
  }
}