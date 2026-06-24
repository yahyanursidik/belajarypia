import { Refine } from "@refinedev/core";
import type { PropsWithChildren } from "react";
import { accessControlProvider } from "./accessControlProvider";
import { authProvider } from "./authProvider";
import { dataProvider } from "./dataProvider";

export function RefineAppProvider({ children }: PropsWithChildren) {
  return (
    <Refine
      dataProvider={dataProvider}
      authProvider={authProvider}
      accessControlProvider={accessControlProvider}
      options={{
        warnWhenUnsavedChanges: true,
        projectId: "ypia-lms",
      }}
      resources={[
        { name: "public", list: "/" },
        { name: "auth", list: "/auth/login" },
        { name: "admin", list: "/admin" },
        { name: "teacher", list: "/teacher" },
        { name: "learner", list: "/learner" },
        { name: "superadmin", list: "/superadmin" },
        {
          name: "organizations",
          list: "/superadmin/unit-governance",
          create: "/superadmin/unit-governance",
          meta: { label: "Organisasi" },
        },
        {
          name: "units",
          list: "/superadmin/unit-governance",
          create: "/superadmin/unit-governance",
          meta: { label: "Unit" },
        },
        {
          name: "programs",
          list: "/admin/program",
          create: "/admin/program",
          meta: { label: "Program" },
        },
        {
          name: "batches",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Batch" },
        },
        {
          name: "classes",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Kelas" },
        },
        {
          name: "halaqahs",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Halaqah" },
        },
        {
          name: "levels",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Level" },
        },
        {
          name: "program_modules",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Modul" },
        },
        {
          name: "lessons",
          list: "/learner/program-saya",
          create: "/admin/akademik",
          meta: { label: "Lesson" },
        },
        {
          name: "lesson_prerequisites",
          list: "/admin/akademik",
          create: "/admin/akademik",
          meta: { label: "Prerequisite Lesson" },
        },
        {
          name: "document_files",
          list: "/learner/program-saya",
          create: "/admin/akademik",
          meta: { label: "Dokumen Lesson" },
        },
        {
          name: "applicants",
          list: "/admin/pendaftaran",
          meta: { label: "Pendaftaran" },
        },
        {
          name: "participants",
          list: "/admin/peserta",
          meta: { label: "Peserta" },
        },
        {
          name: "enrollments",
          list: "/admin/enrollment",
          meta: { label: "Enrollment" },
        },
      ]}
    >
      {children}
    </Refine>
  );
}
