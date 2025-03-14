/*
 * Copyright (c) [2024-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { ReactNode, forwardRef, useImperativeHandle, useState } from "react";
import {
  Drawer as PFDrawer,
  DrawerPanelBody,
  DrawerPanelContent,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerActions,
  DrawerCloseButton,
  DrawerProps as PFDrawerProps,
} from "@patternfly/react-core";

type DrawerProps = {
  panelHeader: ReactNode;
  panelContent: ReactNode;
} & PFDrawerProps;

/**
 * PF/Drawer wrapper
 *
 * NOTE: Although the React documentation encourages to use props over
 * impreative behaviours, this looks a more than reasanable use case for
 * keeping the state and its manipulation inside the component instead of
 * its parent, just exposing a kind of "public API" to influence it.
 *
 * @todo write documentation
 */
const Drawer = forwardRef(
  ({ panelHeader, panelContent, isExpanded = false, children }: DrawerProps, ref) => {
    const [isOpen, setIsOpen] = useState(isExpanded);
    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    const publicAPI = () => ({ open, close });

    useImperativeHandle(ref, publicAPI, []);

    const onEscape = (event) => event.key === "Escape" && close();

    return (
      <PFDrawer isExpanded={isOpen} onKeyDown={onEscape}>
        <DrawerContent
          panelContent={
            <DrawerPanelContent focusTrap={{ enabled: true }}>
              <DrawerHead>
                {panelHeader}
                <DrawerActions>
                  <DrawerCloseButton onClick={close} />
                </DrawerActions>
              </DrawerHead>
              <DrawerPanelBody>{panelContent}</DrawerPanelBody>
            </DrawerPanelContent>
          }
          colorVariant="primary"
        >
          <DrawerContentBody>{children}</DrawerContentBody>
        </DrawerContent>
      </PFDrawer>
    );
  },
);

export default Drawer;
