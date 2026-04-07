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
import { plainRender } from "~/test-utils";
import Interpolate from "./Interpolate";

describe("Interpolate", () => {
  describe("with a [label] placeholder", () => {
    it("renders the surrounding text", () => {
      const { container } = plainRender(
        <Interpolate template="Go to [settings] page">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.textContent).toBe("Go to settings page");
    });

    it("passes the extracted label to children", () => {
      const { container } = plainRender(
        <Interpolate template="Go to [settings] page">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.querySelector("strong")).toHaveTextContent("settings");
    });

    it("works when the placeholder is at the start", () => {
      const { container } = plainRender(
        <Interpolate template="[Start] of the sentence">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.textContent).toBe("Start of the sentence");
      expect(container.querySelector("strong")).toHaveTextContent("Start");
    });

    it("works when the placeholder is at the end", () => {
      const { container } = plainRender(
        <Interpolate template="End of the [sentence]">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.textContent).toBe("End of the sentence");
      expect(container.querySelector("strong")).toHaveTextContent("sentence");
    });

    it("works when the whole template is the placeholder", () => {
      const { container } = plainRender(
        <Interpolate template="[only]">{(label) => <strong>{label}</strong>}</Interpolate>,
      );
      expect(container.textContent).toBe("only");
      expect(container.querySelector("strong")).toHaveTextContent("only");
    });

    it("passes an empty string to children when the brackets are empty", () => {
      const { container } = plainRender(
        <Interpolate template="Click [] to continue">
          {(label) => <strong aria-label="injected">{label}</strong>}
        </Interpolate>,
      );
      expect(container.querySelector("strong")).toBeEmptyDOMElement();
    });

    it("throws when multiple placeholders are present", () => {
      expect(() =>
        plainRender(
          <Interpolate template="[first] and [second]">
            {(label) => <strong>{label}</strong>}
          </Interpolate>,
        ),
      ).toThrow("Interpolate: only one [label] placeholder is supported.");
    });
  });

  describe("with a %s placeholder", () => {
    it("renders the surrounding text", () => {
      const { container } = plainRender(
        <Interpolate template="Go to %s page">{() => <strong>settings</strong>}</Interpolate>,
      );
      expect(container.textContent).toBe("Go to settings page");
    });

    it("calls children with an empty string", () => {
      const received: string[] = [];
      plainRender(
        <Interpolate template="Go to %s page">
          {(label) => {
            received.push(label);
            return <strong>{label}</strong>;
          }}
        </Interpolate>,
      );
      expect(received).toEqual([""]);
    });

    it("works when the placeholder is at the start", () => {
      const { container } = plainRender(
        <Interpolate template="%s is at the start">{() => <strong>This</strong>}</Interpolate>,
      );
      expect(container.textContent).toBe("This is at the start");
      expect(container.querySelector("strong")).toHaveTextContent("This");
    });

    it("works when the placeholder is at the end", () => {
      const { container } = plainRender(
        <Interpolate template="At the end: %s">{() => <strong>here</strong>}</Interpolate>,
      );
      expect(container.textContent).toBe("At the end: here");
    });

    it("works when the whole template is the placeholder", () => {
      const { container } = plainRender(
        <Interpolate template="%s">{() => <strong>everything</strong>}</Interpolate>,
      );
      expect(container.textContent).toBe("everything");
    });

    it("throws when multiple placeholders are present", () => {
      expect(() =>
        plainRender(
          <Interpolate template="First %s and second %s">{() => <strong>X</strong>}</Interpolate>,
        ),
      ).toThrow("Interpolate: only one %s placeholder is supported.");
    });
  });

  describe("without a placeholder", () => {
    it("renders the template as plain text", () => {
      const { container } = plainRender(
        <Interpolate template="No placeholder here">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.textContent).toBe("No placeholder here");
    });

    it("does not render any injected content", () => {
      const { container } = plainRender(
        <Interpolate template="No placeholder here">
          {(label) => <strong>{label}</strong>}
        </Interpolate>,
      );
      expect(container.querySelector("strong")).toBeNull();
    });
  });

  describe("when children returns null", () => {
    it("renders the surrounding text without the injected node", () => {
      const { container } = plainRender(
        <Interpolate template="Before [label] after">{() => null}</Interpolate>,
      );
      expect(container.textContent).toBe("Before  after");
      expect(container.querySelector("strong")).toBeNull();
    });
  });
});
