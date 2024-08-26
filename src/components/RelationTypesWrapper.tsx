import React from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../DataContext";
import { planUpdateRelationTypes, usePlanner } from "../planner";
import { RelationTypes } from "./RelationTypes";

export function RelationTypesWrapper(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const { relationTypes } = useData();
  const submit = async (relationTypeState: RelationTypes): Promise<void> => {
    const plan = planUpdateRelationTypes(createPlan(), relationTypeState);
    await executePlan(plan);
    navigate("/");
  };

  return <RelationTypes relationTypes={relationTypes} onSubmit={submit} />;
}
