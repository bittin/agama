/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import {
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import Link from "~/components/core/Link";
import { useIssues } from "~/hooks/model/issue";
import { REGISTRATION, NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Empty state shown when software selection is unavailable.
 *
 * This happens when there are product issues preventing software selection:
 * - missing_registration: base product missing because not registered
 * - missing_product: base product missing
 *
 * The component reads product issues from the backend and displays the appropriate
 * description and action links.
 */
export default function PatternSelectionUnavailable() {
  const issues = useIssues("product");

  const missingRegistration = issues.find((i) => i.class === "missing_registration");
  const missingProduct = issues.find((i) => i.class === "missing_product");

  const EmptyStateIcon = () => <Icon name="apps_outage" />;

  return (
    // TRANSLATORS: empty state title when software cannot be selected
    <EmptyState
      headingLevel="h2"
      titleText={_("Software selection is not available")}
      variant="lg"
      icon={EmptyStateIcon}
    >
      <EmptyStateBody>
        {missingRegistration && (
          <Content component="p" isEditorial>
            {missingRegistration.description}
          </Content>
        )}
        {missingProduct && (
          <>
            <Content component="p" isEditorial>
              {missingProduct.description}
            </Content>
            <Content component="small">
              {/* TRANSLATORS: additional hint when base product is missing */}
              {_("This might be due to network connectivity.")}
            </Content>
          </>
        )}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          {missingRegistration && (
            <Link to={REGISTRATION.root} variant="link" isInline>
              {/* TRANSLATORS: link to go to registration settings */}
              {_("Go to registration")}
            </Link>
          )}
          {missingProduct && (
            <Link to={NETWORK.root} variant="link" isInline>
              {/* TRANSLATORS: link to go to network settings */}
              {_("Go to network settings")}
            </Link>
          )}
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
