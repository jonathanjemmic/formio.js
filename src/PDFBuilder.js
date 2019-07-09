import _ from 'lodash';
import NativePromise from 'native-promise-only';
import fetchPonyfill from 'fetch-ponyfill';

import WebformBuilder from './WebformBuilder';
import { getElementRect } from './utils/utils';
import BuilderUtils from './utils/builder';
import PDF from './PDF';
const { fetch, Headers } = fetchPonyfill({
  Promise: NativePromise
});

export default class PDFBuilder extends WebformBuilder {
  constructor() {
    let element, options;
    if (arguments[0] instanceof HTMLElement || arguments[1]) {
      element = arguments[0];
      options = arguments[1];
    }
    else {
      options = arguments[0];
    }

    // Force superclass to skip the automatic init; we'll trigger it manually
    options.skipInit = true;

    if (element) {
      super(element, options);
    }
    else {
      super(options);
    }

    this.dragDropEnabled = false;
  }

  get defaultGroups() {
    return {
      pdf: {
        title: 'PDF Fields',
        weight: 0,
        default: true,
        components: {
          textfield: true,
          number: true,
          password: true,
          email: true,
          phoneNumber: true,
          currency: true,
          checkbox: true,
          signature: true,
          select: true,
          textarea: true,
          datetime: true
        }
      },
      basic: false,
      advanced: false,
      layout: false,
      data: false,
      premium: false,
      resource: false
    };
  }

  get hasPDF() {
    return _.has(this.webform, 'form.settings.pdf');
  }

  // 888      d8b  .d888                                    888
  // 888      Y8P d88P"                                     888
  // 888          888                                       888
  // 888      888 888888 .d88b.   .d8888b 888  888  .d8888b 888  .d88b.
  // 888      888 888   d8P  Y8b d88P"    888  888 d88P"    888 d8P  Y8b
  // 888      888 888   88888888 888      888  888 888      888 88888888
  // 888      888 888   Y8b.     Y88b.    Y88b 888 Y88b.    888 Y8b.
  // 88888888 888 888    "Y8888   "Y8888P  "Y88888  "Y8888P 888  "Y8888
  //                                           888
  //                                      Y8b d88P
  //                                       "Y88P"

  init() {
    this.options.attachMode = 'builder';
    this.webform = this.webform || this.createForm(this.options);
    this.webform.init();
  }

  render() {
    const result = this.renderTemplate('pdfBuilder', {
      sidebar: this.renderTemplate('builderSidebar', {
        scrollEnabled: this.sideBarScroll,
        groupOrder: this.groupOrder,
        groupId: `builder-sidebar-${this.id}`,
        groups: this.groupOrder.map((groupKey) => this.renderTemplate('builderSidebarGroup', {
          group: this.groups[groupKey],
          groupKey,
          groupId: `builder-sidebar-${this.id}`,
          subgroups: this.groups[groupKey].subgroups.map((group) => this.renderTemplate('builderSidebarGroup', {
            group,
            groupKey: group.key,
            groupId: `builder-sidebar-${groupKey}`,
            subgroups: []
          })),
        })),
      }),
      form: _.has(this.webform, 'form.settings.pdf') ?
        this.webform.render() :
        this.renderTemplate('pdfBuilderUpload', {})
    });

    return result;
  }

  attach(element) {
    // PDF Upload
    if (!this.hasPDF) {
      this.loadRefs(element, {
        'fileDrop': 'single',
        'fileBrowse': 'single',
        'hiddenFileInputElement': 'single',
        'uploadError': 'single',
      });
      this.addEventListener(this.refs['pdf-upload-button'], 'click',(event) => {
        event.preventDefault();
      });

      // Init the upload error.
      if (!this.options.pdfServer) {
        this.setUploadError('PDF Server not set. Please set the PDF Server in options.pdfServer so the upload can occur.');
      }
      else {
        this.setUploadError();
      }

      if (this.refs.fileDrop) {
        const element = this;
        this.addEventListener(this.refs.fileDrop, 'dragover', function(event) {
          this.className = 'fileSelector fileDragOver';
          event.preventDefault();
        });
        this.addEventListener(this.refs.fileDrop, 'dragleave', function(event) {
          this.className = 'fileSelector';
          event.preventDefault();
        });
        this.addEventListener(this.refs.fileDrop, 'drop', function(event) {
          this.className = 'fileSelector';
          event.preventDefault();
          element.upload(event.dataTransfer.files[0]);
          return false;
        });
      }

      if (this.refs.fileBrowse && this.refs.hiddenFileInputElement) {
        this.addEventListener(this.refs.fileBrowse, 'click', (event) => {
          event.preventDefault();
          // There is no direct way to trigger a file dialog. To work around this, create an input of type file and trigger
          // a click event on it.
          if (typeof this.refs.hiddenFileInputElement.trigger === 'function') {
            this.refs.hiddenFileInputElement.trigger('click');
          }
          else {
            this.refs.hiddenFileInputElement.click();
          }
        });
        this.addEventListener(this.refs.hiddenFileInputElement, 'change', () => {
          this.upload(this.refs.hiddenFileInputElement.files[0]);
          this.refs.hiddenFileInputElement.value = '';
        });
      }

      return NativePromise.resolve();
    }

    // Normal PDF Builder
    return super.attach(element).then(() => {
      this.loadRefs(this.element, {
        iframeDropzone: 'single', 'sidebar-container': 'single'
      });

      if (this.refs.iframeDropzone) {
        this.initIframeEvents();
        this.updateDropzoneDimensions();
        this.initDropzoneEvents();
      }

      if (this.refs['sidebar-container']) {
        this.prepSidebarComponentsForDrag();
      }

      return this.element;
    });
  }

  upload(file) {
    const headers = new Headers({
      'Accept': 'application/json, text/plain, */*',
      'Content-type': 'multipart/form-data',
      // 'x-file-token': tempToken,
    });

    fetch(this.options.pdfServer, {
      method: 'POST',
      headers,
      form: {
        file,
      }
    })
      .then(response => {
        if (response.status !== 200) {
          response.text().then(info => {
            this.setUploadError(`${response.statusText} - ${info}`);
          });
        }
        else {
          // TODO: Set settings.pdf here.
          this.rebuild();
        }
      })
      .catch(response => {
        this.setUploadError('Upload failed.');
        console.log('fail', response);
      });
  }

  setUploadError(message) {
    if (!this.refs.uploadError) {
      return;
    }
    this.refs.uploadError.style.display = message ? '' : 'none';
    this.refs.uploadError.innerHTML = message;
  }

  createForm(options) {
    // Instantiate the webform from the PDF class instead of Webform
    options.skipInit = false;
    this.webform = new PDF(this.element, options);

    this.webform.on('attach', this.onPdfAttach.bind(this));

    return this.webform;
  }

  setForm(form) {
    return super.setForm(form).then(() => {
      return this.ready.then(() => {
        if (this.webform) {
          this.webform.postMessage({ name: 'form', data: form });
          return this.webform.setForm(form);
        }
        return form;
      });
    });
  }

  onPdfAttach() {
    // If the dropzone exists but has been removed in a PDF rebuild, reinstate it
    if (this.refs.iframeDropzone && ![...this.refs.form.children].includes(this.refs.iframeDropzone)) {
      this.prependTo(this.refs.iframeDropzone, this.refs.form);
    }
  }

  destroy() {
    super.destroy();

    this.webform.destroy();
  }

  // d8b 8888888888                                                                              888
  // Y8P 888                                                                                     888
  //     888                                                                                     888
  // 888 8888888 888d888 8888b.  88888b.d88b.   .d88b.        .d88b.  888  888  .d88b.  88888b.  888888 .d8888b
  // 888 888     888P"      "88b 888 "888 "88b d8P  Y8b      d8P  Y8b 888  888 d8P  Y8b 888 "88b 888    88K
  // 888 888     888    .d888888 888  888  888 88888888      88888888 Y88  88P 88888888 888  888 888    "Y8888b.
  // 888 888     888    888  888 888  888  888 Y8b.          Y8b.      Y8bd8P  Y8b.     888  888 Y88b.       X88
  // 888 888     888    "Y888888 888  888  888  "Y8888        "Y8888    Y88P    "Y8888  888  888  "Y888  88888P'

  initIframeEvents() {
    this.webform.on('iframe-elementUpdate', schema => {
      const component = this.webform.getComponentById(schema.id);
      if (component && component.component) {
        component.component.overlay = {
          page: schema.page,
          left: schema.left,
          top: schema.top,
          height: schema.height,
          width: schema.width
        };
        this.editComponent(component.component, this.webform.iframeElement);
        this.emit('updateComponent', component);
      }
      return component;
    });

    this.webform.on('iframe-componentUpdate', schema => {
      const component = this.webform.getComponentById(schema.id);
      if (component && component.component) {
        component.component.overlay = {
          page: schema.overlay.page,
          left: schema.overlay.left,
          top: schema.overlay.top,
          height: schema.overlay.height,
          width: schema.overlay.width
        };
        this.emit('updateComponent', component);
        this.emit('change', this.form);
      }
      return component;
    });

    this.webform.on('iframe-componentClick', schema => {
      const component = this.webform.getComponentById(schema.id);
      if (component) {
        this.editComponent(component.component, this.webform.iframeElement);
      }
    }, true);
  }

  // 8888888b.                                                                   888                   d8b
  // 888  "Y88b                                                                  888                   Y8P
  // 888    888                                                                  888
  // 888    888 888d888 .d88b.  88888b. 88888888  .d88b.  88888b.   .d88b.       888  .d88b.   .d88b.  888  .d8888b
  // 888    888 888P"  d88""88b 888 "88b   d88P  d88""88b 888 "88b d8P  Y8b      888 d88""88b d88P"88b 888 d88P"
  // 888    888 888    888  888 888  888  d88P   888  888 888  888 88888888      888 888  888 888  888 888 888
  // 888  .d88P 888    Y88..88P 888 d88P d88P    Y88..88P 888  888 Y8b.          888 Y88..88P Y88b 888 888 Y88b.
  // 8888888P"  888     "Y88P"  88888P" 88888888  "Y88P"  888  888  "Y8888       888  "Y88P"   "Y88888 888  "Y8888P
  //                            888                                                                888
  //                            888                                                           Y8b d88P
  //                            888                                                            "Y88P"

  initDropzoneEvents() {
    // This is required per HTML spec in order for the drop event to fire
    this.addEventListener(this.refs.iframeDropzone, 'dragover', (e) => {
      e.preventDefault();
      return false;
    });

    this.addEventListener(this.refs.iframeDropzone, 'drop', this.onDropzoneDrop.bind(this));
  }

  prepSidebarComponentsForDrag() {
    [...this.refs['sidebar-container'].children].forEach(el => {
      el.draggable = true;
      el.setAttribute('draggable', true);

      this.addEventListener(el, 'dragstart', this.onDragStart.bind(this), true);
      this.addEventListener(el, 'dragend',   this.onDragEnd  .bind(this), true);
    });
  }

  updateDropzoneDimensions() {
    if (!this.refs.iframeDropzone) {
      return;
    }

    const iframeRect = getElementRect(this.webform.refs.iframeContainer);
    this.refs.iframeDropzone.style.height = iframeRect && iframeRect.height ? `${iframeRect.height}px` : '1000px';
    this.refs.iframeDropzone.style.width  = iframeRect && iframeRect.width  ? `${iframeRect.width }px` : '100%';
  }

  onDragStart(e) {
    e.dataTransfer.setData('text/html', null);

    this.updateDropzoneDimensions();
    this.addClass(this.refs.iframeDropzone, 'enabled');
  }

  onDropzoneDrop(e) {
    this.dropEvent = e;
    e.preventDefault();
    return false;
  }

  onDragEnd(e) {
    // IMPORTANT - must retrieve offsets BEFORE disabling the dropzone - offsets will
    // reflect absolute positioning if accessed after the target element is hidden
    const offsetX = this.dropEvent ? this.dropEvent.offsetX : null;
    const offsetY = this.dropEvent ? this.dropEvent.offsetY : null;

    // Always disable the dropzone on drag end
    this.removeClass(this.refs.iframeDropzone, 'enabled');

    // If there hasn't been a drop event on the dropzone, we're done
    if (!this.dropEvent) {
      return;
    }

    const element = e.target;
    const type = element.getAttribute('data-type');

    const schema = _.cloneDeep(this.schemas[type]);

    schema.key = _.camelCase(
      schema.label ||
      schema.placeholder ||
      schema.type
    );

    // Set a unique key for this component.
    BuilderUtils.uniquify([this.webform.component], schema);

    this.webform.component.components.push(schema);

    this.emit('addComponent', schema);

    schema.overlay = {
      top: offsetY,
      left: offsetX,
      width: 100,
      height: 20
    };

    this.webform.addComponent(schema, {}, null, true);
    this.webform.postMessage({ name: 'addElement', data: schema });

    // Delete the stored drop event now that it's been handled
    this.dropEvent = null;
  }
}
