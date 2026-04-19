/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { useState } from "react";
import xbytes from "xbytes";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  Flex,
  Spinner,
} from "@patternfly/react-core";
import IssuesAlert from "~/components/core/IssuesAlert";
import Link from "~/components/core/Link";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/software";
import { useSystem } from "~/hooks/model/system/software";
import { isPatternSelected } from "~/utils/software";
import { SOFTWARE as PATHS } from "~/routes/paths";
import { N_, _ } from "~/i18n";

import type { Pattern } from "~/model/system/software";

/**
 * List of selected patterns.
 */
const SelectedPatternsList = ({ patterns }: { patterns: Pattern[] }): React.ReactNode => {
  if (patterns.length === 0) {
    return <>{_("No additional software was selected.")}</>;
  }

  return (
    <DescriptionList>
      {patterns.map((pattern) => (
        <DescriptionListGroup key={pattern.name}>
          <DescriptionListTerm>{pattern.summary}</DescriptionListTerm>
          <DescriptionListDescription>{pattern.description}</DescriptionListDescription>
        </DescriptionListGroup>
      ))}
    </DescriptionList>
  );
};

const Summary = ({
  selectedCount,
  usedSize,
}: {
  selectedCount: number;
  usedSize?: string;
}): React.ReactNode => {
  const summaryText = usedSize
    ? sprintf(
        // TRANSLATORS: %1$d is the number of selected patterns, %2$s is the total installation size
        // (e.g., "5 selected patterns, total size needed: 4.60 GiB")
        _("%1$d selected patterns, total size needed: %2$s"),
        selectedCount,
        usedSize,
      )
    : sprintf(
        // TRANSLATORS: %d is the number of selected patterns
        _("%d selected patterns"),
        selectedCount,
      );

  return (
    <Flex direction={{ default: "column" }}>
      <Content isEditorial>
        <Text>{summaryText}</Text>
      </Content>
    </Flex>
  );
};

const SelectedPatterns = ({ patterns }: { patterns: Pattern[] }): React.ReactNode => (
  <Page.Section
    title={_("Selected patterns")}
    actions={
      <Link to={PATHS.patternsSelection} isPrimary>
        {_("Change selection")}
      </Link>
    }
  >
    <SelectedPatternsList patterns={patterns} />
  </Page.Section>
);

const NoPatterns = (): React.ReactNode => (
  <Page.Section title={_("Selected patterns")}>
    <p>
      {_(
        "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.",
      )}
    </p>
  </Page.Section>
);

const errorMsg = N_(
  /* TRANSLATORS: error details followed by a "Try again" link*/
  "Some installation repositories could not be loaded. \
The system cannot be installed without them.",
);

// error message, allow reloading the repositories again
const ReloadSection = ({
  loading,
  action,
}: {
  loading: boolean;
  action: () => void;
}): React.ReactNode => (
  // TRANSLATORS: title for an error message box, at least one repository could not be loaded
  <Alert variant="danger" isInline title={_("Repository load failed")}>
    {loading ? (
      <>
        {/* TRANSLATORS: progress message */}
        <Spinner size="md" /> {_("Loading the installation repositories...")}
      </>
    ) : (
      <>
        {_(errorMsg)}{" "}
        <Button variant="link" isInline onClick={action}>
          {/* TRANSLATORS: link for retrying failed repository load */}
          {_("Try again")}
        </Button>
      </>
    )}
  </Alert>
);

const PageContent = () => {
  const { patterns } = useSystem();
  const proposal = useProposal();
  const issues = useIssues("software");
  const [loading, setLoading] = useState(false);

  if (!proposal) {
    return <EmptyState headingLevel="h2" titleText={_("No information available yet")} />;
  }

  // FIXME: temporarily disabled, the API end point is not implemented yet
  const repos = []; // useRepositories();
  const usedSize = proposal.usedSpace
    ? xbytes(proposal.usedSpace * 1024, { iec: true })
    : undefined;
  const selectedPatterns = patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));

  const startProbing = () => {
    setLoading(true);
    // TODO: probe();
  };

  const showReposAlert = repos.some((r) => !r.loaded);

  return (
    <>
      <Page.Content>
        <IssuesAlert issues={issues} />
        {showReposAlert && <ReloadSection loading={loading} action={startProbing} />}
        {isEmpty(proposal.patterns) ? (
          <NoPatterns />
        ) : (
          <>
            <Summary selectedCount={selectedPatterns.length} usedSize={usedSize} />
            <SelectedPatterns patterns={selectedPatterns} />
          </>
        )}
      </Page.Content>
    </>
  );
};

/**
 * Software page component
 */
function SoftwarePage(): React.ReactNode {
  return (
    <Page breadcrumbs={[{ label: _("Software") }]} progress={{ scope: "software" }}>
      <PageContent />
    </Page>
  );
}

export default SoftwarePage;
