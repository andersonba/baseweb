/*
Copyright (c) 2018-2019 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
// @flow
/* global document */
import * as React from 'react';
import FocusLock from 'react-focus-lock';

import {LocaleContext} from '../locale/index.js';
import {getOverrides} from '../helpers/overrides.js';
import {Layer} from '../layer/index.js';
import {SIZE, ROLE, CLOSE_SOURCE} from './constants.js';
import {
  Root as StyledRoot,
  Backdrop as StyledBackdrop,
  Dialog as StyledDialog,
  DialogContainer as StyledDialogContainer,
  Close as StyledClose,
} from './styled-components.js';
import {CloseIcon} from './close-icon.js';

import type {
  ModalPropsT,
  ModalStateT,
  SharedStylePropsArgT,
  CloseSourceT,
  ElementRefT,
} from './types.js';

class Modal extends React.Component<ModalPropsT, ModalStateT> {
  static defaultProps: $Shape<ModalPropsT> = {
    animate: true,
    // remove in a future major version
    autofocus: false,
    autoFocus: true,
    closeable: true,
    isOpen: false,
    overrides: {},
    role: ROLE.dialog,
    size: SIZE.default,
  };

  animateOutTimer: ?TimeoutID;
  animateStartTimer: ?AnimationFrameID;
  lastFocus: ?HTMLElement = null;
  lastMountNodeOverflowStyle: ?string = null;
  _refs: {[string]: ElementRefT} = {};

  state = {
    isVisible: false,
    mounted: false,
  };

  componentDidMount() {
    this.setState({mounted: true});
  }

  componentWillUnmount() {
    this.removeDomEvents();
    this.resetMountNodeScroll();
    this.clearTimers();
  }

  componentDidUpdate(prevProps: ModalPropsT, prevState: ModalStateT) {
    const {isOpen} = this.props;
    if (
      // If isOpen is changing *or* we just mounted and modal should be open
      isOpen !== prevProps.isOpen ||
      (isOpen && this.state.mounted && !prevState.mounted)
    ) {
      if (isOpen) {
        this.didOpen();
      } else {
        this.didClose();
      }
    }
  }

  addDomEvents() {
    if (__BROWSER__) {
      document.addEventListener('keyup', this.onDocumentKeyPress);
    }
  }

  removeDomEvents() {
    if (__BROWSER__) {
      document.removeEventListener('keyup', this.onDocumentKeyPress);
    }
  }

  disableMountNodeScroll() {
    const mountNode = this.getMountNode();
    this.lastMountNodeOverflowStyle = mountNode.style.overflow || '';
    mountNode.style.overflow = 'hidden';
  }

  resetMountNodeScroll() {
    const mountNode = this.getMountNode();
    const lastStyle = this.lastMountNodeOverflowStyle;
    if (mountNode && lastStyle !== null) {
      mountNode.style.overflow = lastStyle || '';
      this.lastMountNodeOverflowStyle = null;
    }
  }

  onDocumentKeyPress = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    // Ignore events that have been `event.preventDefault()` marked.
    if (event.defaultPrevented) {
      return;
    }

    if (!this.props.closeable) {
      return;
    }

    this.triggerClose(CLOSE_SOURCE.escape);
  };

  onBackdropClick = () => {
    if (!this.props.closeable) {
      return;
    }
    this.triggerClose(CLOSE_SOURCE.backdrop);
  };

  onCloseClick = () => {
    this.triggerClose(CLOSE_SOURCE.closeButton);
  };

  clearTimers() {
    if (this.animateOutTimer) {
      clearTimeout(this.animateOutTimer);
    }
    if (this.animateStartTimer) {
      // eslint-disable-next-line cup/no-undef
      cancelAnimationFrame(this.animateStartTimer);
    }
  }

  didOpen() {
    // Sometimes scroll starts past zero, possibly due to animation
    // Reset scroll to 0 (other libraries do this as well)
    const rootRef = this.getRef('Root').current;
    if (rootRef) {
      rootRef.scrollTop = 0;
    }

    // Clear any existing timers (like previous animateOutTimer)
    this.clearTimers();

    this.addDomEvents();
    this.disableMountNodeScroll();

    // eslint-disable-next-line cup/no-undef
    this.animateStartTimer = requestAnimationFrame(() => {
      this.setState({isVisible: true});
    });
  }

  didClose() {
    this.removeDomEvents();
    this.resetMountNodeScroll();
    this.animateOutTimer = setTimeout(this.animateOutComplete, 500);
  }

  triggerClose(source?: CloseSourceT) {
    // If there's no source, it just means the isOpen prop changed. No need to call onClose.
    if (this.props.onClose && source) {
      this.props.onClose({
        closeSource: source,
      });
    }
  }

  animateOutComplete = () => {
    this.setState({
      isVisible: false,
    });
  };

  getSharedProps(): $Diff<SharedStylePropsArgT, {children?: React.Node}> {
    const {animate, isOpen, size, role, closeable} = this.props;
    return {
      $animate: animate,
      $isVisible: this.state.isVisible,
      $isOpen: !!isOpen,
      $size: size,
      $role: role,
      $closeable: !!closeable,
    };
  }

  getMountNode(): HTMLElement {
    const {mountNode} = this.props;
    if (mountNode) {
      return mountNode;
    }
    // Flow thinks body could be null (cast through any)
    // eslint-disable-next-line flowtype/no-weak-types
    return ((document.body: any): HTMLBodyElement);
  }

  getChildren() {
    const {children} = this.props;
    return typeof children === 'function' ? children() : children;
  }

  getRef(component: string): ElementRefT {
    if (!this._refs[component]) {
      this._refs[component] = React.createRef();
    }
    return this._refs[component];
  }

  renderModal() {
    const {overrides = {}, closeable, role} = this.props;

    const {
      Root: RootOverride,
      Dialog: DialogOverride,
      DialogContainer: DialogContainerOverride,
      Backdrop: BackdropOverride,
      Close: CloseOverride,
    } = overrides;

    const [Root, rootProps] = getOverrides(RootOverride, StyledRoot);
    const [Backdrop, backdropProps] = getOverrides(
      BackdropOverride,
      StyledBackdrop,
    );
    const [DialogContainer, dialogContainerProps] = getOverrides(
      DialogContainerOverride,
      StyledDialogContainer,
    );
    const [Dialog, dialogProps] = getOverrides(DialogOverride, StyledDialog);
    const [Close, closeProps] = getOverrides(CloseOverride, StyledClose);

    const sharedProps = this.getSharedProps();
    const children = this.getChildren();

    if (this.props.autofocus && __DEV__) {
      console.warn(
        `The prop "autofocus" is deprecated in favor of "autoFocus" to be consistent across the project.
        The property "autofocus" will be removed in a future major version.`,
      );
    }

    return (
      <LocaleContext.Consumer>
        {locale => (
          <FocusLock
            returnFocus
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={this.props.autofocus || this.props.autoFocus}
          >
            <Root
              data-baseweb="modal"
              ref={this.getRef('Root')}
              {...sharedProps}
              {...rootProps}
            >
              <Backdrop
                onClick={this.onBackdropClick}
                {...sharedProps}
                {...backdropProps}
              />
              <DialogContainer {...sharedProps} {...dialogContainerProps}>
                <Dialog
                  tabIndex={-1}
                  aria-modal={
                    // aria-modal replaces the need to apply aria-hidden="true" to all other page
                    // content underneath the modal.
                    // https://www.w3.org/TR/wai-aria-practices-1.1/examples/dialog-modal/dialog.html
                    'true'
                  }
                  role={role}
                  ref={this.getRef('Dialog')}
                  {...sharedProps}
                  {...dialogProps}
                >
                  {children}
                  {closeable ? (
                    <Close
                      aria-label={locale.modal.close}
                      onClick={this.onCloseClick}
                      {...sharedProps}
                      {...closeProps}
                    >
                      <CloseIcon />
                    </Close>
                  ) : null}
                </Dialog>
              </DialogContainer>
            </Root>
          </FocusLock>
        )}
      </LocaleContext.Consumer>
    );
  }

  render() {
    // Only render modal on the browser (portals aren't supported server-side)
    if (!this.state.mounted) {
      return null;
    }
    // Only render the modal if its isOpen is passed, or isVisible is true (still animating)
    if (!this.props.isOpen && !this.state.isVisible) {
      return null;
    }
    return <Layer mountNode={this.props.mountNode}>{this.renderModal()}</Layer>;
  }
}

export default Modal;
