/*
 * Copyright (c) [2025] SUSE LLC
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

import { useApiModel, useUpdateApiModel } from "~/hooks/storage/api-model";
import { configureFilesystem } from "~/helpers/storage/filesystem";
import { QueryHookOptions } from "~/types/queries";
import { data } from "~/types/storage";

type AddFilesystemFn = (list: string, index: number, data: data.Formattable) => void;

function useAddFilesystem(options?: QueryHookOptions): AddFilesystemFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, index: number, data: data.Formattable) => {
    updateApiModel(configureFilesystem(apiModel, list, index, data));
  };
}

type DeleteFilesystemFn = (list: string, index: number) => void;

function useDeleteFilesystem(options?: QueryHookOptions): DeleteFilesystemFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, index: number) => {
    updateApiModel(configureFilesystem(apiModel, list, index, {}));
  };
}

export { useAddFilesystem, useDeleteFilesystem };
export type { AddFilesystemFn, DeleteFilesystemFn };
