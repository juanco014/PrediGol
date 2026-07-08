import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizarClaveFavorito } from "../utils/favorites";

export { normalizarClaveFavorito };

export function useFavorites(usuarioId) {
  const [teams, setTeams] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!usuarioId) {
      return;
    }

    const [teamsResponse, competitionsResponse] = await Promise.all([
      supabase
        .from("user_favorite_teams")
        .select("id, team_key, team_name, api_football_team_id, created_at")
        .eq("user_id", usuarioId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_favorite_competitions")
        .select(
          "id, competition_key, competition_name, api_football_league_id, created_at"
        )
        .eq("user_id", usuarioId)
        .order("created_at", { ascending: false }),
    ]);

    if (teamsResponse.error) {
      throw teamsResponse.error;
    }

    if (competitionsResponse.error) {
      throw competitionsResponse.error;
    }

    setTeams(teamsResponse.data || []);
    setCompetitions(competitionsResponse.data || []);
    setError("");
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(refresh).catch((refreshError) => {
      console.error("Error al cargar favoritos:", refreshError);

      if (active) {
        setError(refreshError.message || "No fue posible cargar tus favoritos.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [refresh]);

  const teamKeys = useMemo(
    () => new Set(teams.map((team) => team.team_key)),
    [teams]
  );
  const competitionKeys = useMemo(
    () => new Set(competitions.map((competition) => competition.competition_key)),
    [competitions]
  );

  const isTeamFavorite = useCallback(
    (teamName) => teamKeys.has(normalizarClaveFavorito(teamName)),
    [teamKeys]
  );
  const isCompetitionFavorite = useCallback(
    (competitionName) =>
      competitionKeys.has(normalizarClaveFavorito(competitionName)),
    [competitionKeys]
  );

  const toggleTeam = useCallback(
    async (teamName, apiFootballTeamId = null) => {
      const teamKey = normalizarClaveFavorito(teamName);

      if (!usuarioId || !teamKey) {
        return false;
      }

      setSavingKey(`team:${teamKey}`);
      setError("");

      try {
        if (teamKeys.has(teamKey)) {
          const { error: deleteError } = await supabase
            .from("user_favorite_teams")
            .delete()
            .eq("user_id", usuarioId)
            .eq("team_key", teamKey);

          if (deleteError) {
            throw deleteError;
          }

          setTeams((current) =>
            current.filter((team) => team.team_key !== teamKey)
          );
          return false;
        }

        const { data, error: insertError } = await supabase
          .from("user_favorite_teams")
          .upsert(
            {
              user_id: usuarioId,
              team_key: teamKey,
              team_name: teamName.trim(),
              api_football_team_id: apiFootballTeamId,
            },
            { onConflict: "user_id,team_key" }
          )
          .select("id, team_key, team_name, api_football_team_id, created_at")
          .single();

        if (insertError) {
          throw insertError;
        }

        setTeams((current) => [
          data,
          ...current.filter((team) => team.team_key !== teamKey),
        ]);
        return true;
      } catch (toggleError) {
        setError(toggleError.message || "No fue posible actualizar el favorito.");
        throw toggleError;
      } finally {
        setSavingKey("");
      }
    },
    [teamKeys, usuarioId]
  );

  const toggleCompetition = useCallback(
    async (competitionName, apiFootballLeagueId = null) => {
      const competitionKey = normalizarClaveFavorito(competitionName);

      if (!usuarioId || !competitionKey) {
        return false;
      }

      setSavingKey(`competition:${competitionKey}`);
      setError("");

      try {
        if (competitionKeys.has(competitionKey)) {
          const { error: deleteError } = await supabase
            .from("user_favorite_competitions")
            .delete()
            .eq("user_id", usuarioId)
            .eq("competition_key", competitionKey);

          if (deleteError) {
            throw deleteError;
          }

          setCompetitions((current) =>
            current.filter(
              (competition) => competition.competition_key !== competitionKey
            )
          );
          return false;
        }

        const { data, error: insertError } = await supabase
          .from("user_favorite_competitions")
          .upsert(
            {
              user_id: usuarioId,
              competition_key: competitionKey,
              competition_name: competitionName.trim(),
              api_football_league_id: apiFootballLeagueId,
            },
            { onConflict: "user_id,competition_key" }
          )
          .select(
            "id, competition_key, competition_name, api_football_league_id, created_at"
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        setCompetitions((current) => [
          data,
          ...current.filter(
            (competition) => competition.competition_key !== competitionKey
          ),
        ]);
        return true;
      } catch (toggleError) {
        setError(toggleError.message || "No fue posible actualizar el favorito.");
        throw toggleError;
      } finally {
        setSavingKey("");
      }
    },
    [competitionKeys, usuarioId]
  );

  return {
    teams,
    competitions,
    loading,
    savingKey,
    error,
    isTeamFavorite,
    isCompetitionFavorite,
    toggleTeam,
    toggleCompetition,
    refresh,
  };
}
